export const SUPPORTED_PROVIDERS = [
  {
    id: "gemini",
    name: "Gemini (Google)",
    style: "success" // for btn-success
  },
  {
    id: "custom",
    name: "Custom API Endpoint",
    style: "secondary" // for btn-secondary or your choice
  }
];

export const SUPPORTED_MODELS = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    isDefault: true,
    apiId: "gemini-2.0-flash",
    getApiParams: (prompt) => ({
      model: "gemini-2.0-flash",
      contents: prompt
    })
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash (Thinking Enabled)",
    provider: "Google",
    isDefault: false,
    apiId: "gemini-2.5-flash",
    getApiParams: (prompt) => ({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: undefined } }
    })
  },
  {
    id: "gemini-2.5-flash-no-thinking",
    name: "Gemini 2.5 Flash (No Thinking)",
    provider: "Google",
    isDefault: false,
    apiId: "gemini-2.5-flash",
    getApiParams: (prompt) => ({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    })
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro (Thinking Enabled)",
    provider: "Google",
    isDefault: false,
    apiId: "gemini-2.5-pro",
    getApiParams: (prompt) => ({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: undefined } }
    })
  }  
];

// Utility to get the default model
export function getDefaultModel() {
  return SUPPORTED_MODELS.find(m => m.isDefault) || SUPPORTED_MODELS[0];
}

// Utility to get a model by id
export function getModelById(id) {
  return SUPPORTED_MODELS.find(m => m.id === id);
}