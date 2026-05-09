export const formatPhoneNumber = (value: string): string => {
    // Remove non-digit chars
    const numbers = value.replace(/\D/g, '');

    // Limit to 11 digits
    const trimmed = numbers.slice(0, 11);

    // Format: xxxx-xxx-xxxx
    if (trimmed.length <= 4) return trimmed;
    if (trimmed.length <= 7) return `${trimmed.slice(0, 4)}-${trimmed.slice(4)}`;
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 7)}-${trimmed.slice(7)}`;
}
