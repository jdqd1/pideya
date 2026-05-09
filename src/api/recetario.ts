import { API_URL } from "./config";
import type { Recipe } from "../types/recetario";

export async function fetchRecipes(token: string): Promise<Recipe[]> {
    const res = await fetch(`${API_URL}/recetario/recipes`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        throw new Error("Failed to fetch recipes");
    }
    return res.json();
}
