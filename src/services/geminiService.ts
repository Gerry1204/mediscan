import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AlternativeMedicine {
  name: string;
  genericName: string;
  priceEstimate: string;
  advantage: string;
}

export interface MedicineInfo {
  chineseName: string;
  englishName: string;
  genericName: string;
  indications: string;
  dosage: string;
  priceRange: string;
  consultation: string;
  warnings: string;
  alternatives: AlternativeMedicine[];
  category: string;
  imageUrl?: string;
}

const medicineSchema = {
  type: Type.OBJECT,
  properties: {
    chineseName: { type: Type.STRING, description: "藥物中文名稱" },
    englishName: { type: Type.STRING, description: "藥物英文名稱" },
    genericName: { type: Type.STRING, description: "藥物學名 (Generic Name)" },
    indications: { type: Type.STRING, description: "藥物適應症 (什麼症狀會用到)" },
    dosage: { type: Type.STRING, description: "建議用法用量" },
    priceRange: { type: Type.STRING, description: "網路上可查詢到的價格區間或參考售價" },
    consultation: { type: Type.STRING, description: "專業諮詢建議" },
    warnings: { type: Type.STRING, description: "注意事項與警告" },
    category: { type: Type.STRING, description: "藥物分類 (例如：乙醯胺酚類止痛藥)" },
    alternatives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "替代藥物或學名藥名稱" },
          genericName: { type: Type.STRING, description: "其成分學名" },
          priceEstimate: { type: Type.STRING, description: "估計價格" },
          advantage: { type: Type.STRING, description: "推薦原因或優勢" },
        },
        required: ["name", "genericName", "priceEstimate", "advantage"],
      },
      description: "同成分的學名藥或建議替代品清單",
    },
  },
  required: ["chineseName", "englishName", "genericName", "indications", "dosage", "priceRange", "consultation", "warnings", "alternatives", "category"],
};

export async function analyzeMedicine(query: string, imageBase64?: string): Promise<MedicineInfo> {
  const model = "gemini-3-flash-preview";
  
  const contents: any[] = [];
  
  if (imageBase64) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(",")[1] || imageBase64,
      },
    });
  }
  
  contents.push({
    text: query || "請分析這款藥物，提供詳細的醫藥資訊。",
  });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      systemInstruction: "你是一位資深臨床藥劑師。請根據用戶提供的藥名或圖片，提供詳盡的醫藥資訊。1. 識別藥物名稱（中英並列）。2. 提供學名。3. 說明適應症（什麼症狀會用到）。4. 提供網路詢價參考（務必使用 googleSearch 獲取最新藥局或連商實體價格）。5. 提供具體的專業諮詢建議與管道。6. 搜尋同成分的「學名藥」替代品並進行價格對比。7. 列出重要的注意事項。請務必在回應中包含警語：本資訊僅供參考，用藥前請諮詢醫療專業人員。",
      responseMimeType: "application/json",
      responseSchema: medicineSchema,
      tools: [{ googleSearch: {} }],
    },
  });

  if (!response.text) {
    throw new Error("AI 無法識別該藥物，請提供更清楚的名稱或圖片。");
  }

  try {
    return JSON.parse(response.text) as MedicineInfo;
  } catch (e) {
    console.error("Failed to parse AI response", response.text);
    throw new Error("解析 AI 回應時發生錯誤。");
  }
}

export async function chatAboutMedicine(medicine: MedicineInfo, history: {role: 'user' | 'model', text: string}[], message: string) {
  const model = "gemini-3-flash-preview";
  const chatHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  const chat = ai.chats.create({
    model,
    history: chatHistory,
    config: {
      systemInstruction: `你是藥物諮詢師。目前用戶正在詢問關於「${medicine.chineseName} (${medicine.genericName})」的資訊。請針對用戶的問題提供專業建議，強調安全性、副作用與交互作用。若問題超出藥事範圍，請建議點擊「諮詢實體藥師」。重要：請務必保持回答簡短扼要（盡量控制在 100 字以內），並使用口語化的純文字，絕對不要使用 Markdown 符號（例如 ** 或 ###）。`,
    }
  });

  const result = await chat.sendMessage({ message });
  return result.text;
}
