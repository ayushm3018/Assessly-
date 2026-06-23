import axios from "axios"

// Model is configurable via env so you can switch between DeepSeek V3 (cheap, strong)
// and a free-tier model without touching code. Falls back to DeepSeek V3.
const AI_MODEL = process.env.AI_MODEL || "deepseek/deepseek-chat"

export const askAi = async (messages, options = {}) => {
    try {
        if(!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error("Messages array is empty.");
        }

        const body = {
            model: AI_MODEL,
            messages,
        }

        // When we expect JSON, ask the model to return a JSON object.
        // OpenRouter passes this through to models that support it (DeepSeek does).
        if (options.json) {
            body.response_format = { type: "json_object" }
        }

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            body,
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const content = response?.data?.choices?.[0]?.message?.content;

        if (!content || !content.trim()) {
            throw new Error("AI returned empty response.");
        }

        return content
    } catch (error) {
        console.error("OpenRouter Error:", error.response?.data || error.message);
        throw new Error("OpenRouter API Error");
    }
}

// Safely turn a model response into JSON. Models often wrap JSON in ```json fences
// or add stray prose, which makes a bare JSON.parse() crash the route. This strips
// fences and extracts the first {...} block before parsing.
export const extractJson = (text) => {
    if (!text || typeof text !== "string") {
        throw new Error("No text to parse as JSON.");
    }

    // Remove ```json ... ``` or ``` ... ``` fences if present
    let cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        // Fall back to grabbing the first {...} block in the string
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        throw new Error("AI did not return valid JSON.");
    }
}

// Convenience: ask the model and parse the result as JSON in one step.
export const askAiJson = async (messages) => {
    const raw = await askAi(messages, { json: true });
    return extractJson(raw);
}
