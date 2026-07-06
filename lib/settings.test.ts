import { getSettings, getDefaultSettings } from "./settings";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.ANTHROPIC_MODEL = "some/model:free";
  process.env.ANTHROPIC_FALLBACK_MODELS = "fb-one:free, fb-two:free";
  delete process.env.OLLAMA_MODEL;
  delete process.env.OLLAMA_BASE_URL;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("getDefaultSettings", () => {
  it("derives defaults from env vars", () => {
    const s = getDefaultSettings();
    expect(s.provider).toBe("openrouter");
    expect(s.openrouterModel).toBe("some/model:free");
    expect(s.openrouterFallbacks).toEqual(["fb-one:free", "fb-two:free"]);
    expect(s.ollamaBaseUrl).toBe("http://localhost:11434");
    expect(s.ollamaModel).toBe("llama3.1:8b");
  });

  it("respects OLLAMA_MODEL and OLLAMA_BASE_URL overrides", () => {
    process.env.OLLAMA_MODEL = "qwen2.5:7b";
    process.env.OLLAMA_BASE_URL = "http://10.0.0.5:11434";
    const s = getDefaultSettings();
    expect(s.ollamaModel).toBe("qwen2.5:7b");
    expect(s.ollamaBaseUrl).toBe("http://10.0.0.5:11434");
  });
});

describe("getSettings under test env", () => {
  it("returns env-derived defaults without touching the settings file", () => {
    expect(getSettings()).toEqual(getDefaultSettings());
  });
});
