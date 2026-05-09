import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
    private redis: Redis;
    private readonly memoryHits = new Map<string, { totalHits: number; expiresAt: number }>();
    private redisAvailable = true;

    constructor() {
        if (process.env.REDIS_URL) {
            this.redis = new Redis(process.env.REDIS_URL, {
                connectTimeout: 750,
                enableOfflineQueue: false,
                maxRetriesPerRequest: 1,
            });
        } else {
            this.redis = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                connectTimeout: 750,
                enableOfflineQueue: false,
                maxRetriesPerRequest: 1,
            });
        }

        this.redis.on('error', () => {
            this.redisAvailable = false;
        });
    }

    async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
        if (!this.redisAvailable) {
            return this.incrementInMemory(key, ttl);
        }

        const redis = this.redis;
        const multi = redis.multi();

        // Increment the key
        multi.incr(key);
        // Set TTL if not already set (or we can just expire it every time to be safe/lazy)
        // The standard throttler pattern usually sets expiration on first increment
        // But 'incr' doesn't fail if key exists.
        // simpler: INCR, then TTL.

        // We need to know if it's new to set TTL?
        // Redis INCR returns the new value.
        // Let's use lua script or simple pipeline.
        // For simplicity: INCR and EXPIRE if new value is 1.
        // Actually, handling precise TTL sliding window is complex. 
        // NestJS Throttler usually expects:
        // returns { totalHits, time to expire }

        // Let's use a simple PTTL to check remaining time.

        multi.pttl(key);

        try {
            const results = await multi.exec();
            if (!results) {
                throw new Error('Redis transaction failed');
            }

            const [incrErr, incrVal] = results[0];
            const [pttlErr, pttlVal] = results[1];

            if (incrErr || pttlErr) throw incrErr || pttlErr;

            const totalHits = incrVal as number;
            let timeToExpire = pttlVal as number;

            if (totalHits === 1 || timeToExpire === -1) {
                // First hit or no expiry, set generic TTL
                await redis.expire(key, Math.ceil(ttl / 1000));
                timeToExpire = ttl;
            }

            return {
                totalHits,
                timeToExpire: Math.max(0, Math.ceil(timeToExpire / 1000)),
                isBlocked: false, // ThrottlerGuard decides blockage based on limit, we just report hits
                timeToBlockExpire: 0,
            };
        } catch {
            this.redisAvailable = false;
            return this.incrementInMemory(key, ttl);
        }
    }

    private incrementInMemory(key: string, ttl: number): ThrottlerStorageRecord {
        const now = Date.now();
        const current = this.memoryHits.get(key);
        const active = current && current.expiresAt > now
            ? current
            : { totalHits: 0, expiresAt: now + ttl };

        active.totalHits += 1;
        this.memoryHits.set(key, active);

        return {
            totalHits: active.totalHits,
            timeToExpire: Math.max(0, Math.ceil((active.expiresAt - now) / 1000)),
            isBlocked: false,
            timeToBlockExpire: 0,
        };
    }

    onModuleDestroy() {
        this.redis.disconnect();
    }
}
