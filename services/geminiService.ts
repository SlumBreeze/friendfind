import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateIcebreakers = async (userAInterests: string[], userBInterests: string[]): Promise<string[]> => {
  const ai = getAiClient();
  if (!ai) return [
    "Hey! I see we both like " + (userAInterests.find(i => userBInterests.includes(i)) || "hanging out") + ".",
    "What's the best thing you've done recently?",
    "Hi! How is your week going?"
  ];

  try {
    const prompt = `
      Generate 3 short, friendly, and engaging conversation starters (icebreakers) for two potential friends.
      Person A likes: ${userAInterests.join(', ')}.
      Person B likes: ${userBInterests.join(', ')}.
      Focus on shared interests if any, or general friendly topics.
      Return ONLY the 3 sentences separated by newlines. No numbering.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || "";
    return text.split('\n').filter(line => line.trim().length > 0).slice(0, 3);
  } catch (error) {
    console.error("Gemini Icebreaker Error:", error);
    return ["Hi there!", "Love your profile!", "Want to connect?"];
  }
};

export const composeSafetyMessage = async (
  userName: string,
  friendName: string,
  meetupPlace: string,
  meetupTime: string,
  notes?: string
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) {
    return `EMERGENCY ALERT: ${userName} triggered a safety alert. \nMeeting: ${friendName}\nLocation: ${meetupPlace}\nTime: ${meetupTime}`;
  }

  try {
    const prompt = `
      Compose a concise, urgent, but clear email body for a safety alert.
      User '${userName}' is meeting '${friendName}' at '${meetupPlace}' at '${meetupTime}'.
      Additional notes: ${notes || "None"}.
      The email is to be sent to trusted contacts. State the location and time clearly.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text || "Alert sent.";
  } catch (e) {
    return `Safety Alert: Meeting ${friendName} at ${meetupPlace}.`;
  }
};