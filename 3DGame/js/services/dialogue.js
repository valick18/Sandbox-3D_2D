/**
 * Villager Dialogue Service
 * Handles AI communication (Groq), STT (Speech Recognition), and TTS (Text-to-Speech).
 */

// Load API Key from local storage to keep it hidden from source code
export let GROQ_API_KEY = localStorage.getItem('sandbox3d_groq_key') || "";
const PROXY_OR_DIRECT = "https://api.groq.com/openai/v1/chat/completions";

let recognition = null;
let isRecording = false; // Kept for logic compatibility but never set to true

// Voice selection helper
let ukrainianVoices = { male: null, female: null };

function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    // Try to find Ukrainian voices
    const ukVoices = voices.filter(v => v.lang.startsWith('uk'));
    
    if (ukVoices.length > 0) {
        // Simple heuristic: search for 'female' or 'male' in name, or just pick first
        ukrainianVoices.female = ukVoices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('irina')) || ukVoices[0];
        ukrainianVoices.male = ukVoices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('pavel')) || ukVoices[0];
    }
}

window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

export class DialogueService {
    constructor() {
        this.history = [];
        this.isUIOpen = false;
        this.currentVillager = null;
        this.playerName = localStorage.getItem('sandbox3d_playername') || 'Мандрівник';
        
        this.setupSTT();
    }

    setupSTT() {
        // Microphone feature disabled by user request
    }

    startRecording() {} // Disabled
    stopRecording() {}  // Disabled

    updateSTTUI() {
        const indicator = document.getElementById('stt-indicator');
        if (indicator) {
            indicator.style.display = isRecording ? 'block' : 'none';
        }
    }

    async handleUserMessage(text) {
        if (!text || !this.currentVillager) return;
        
        // Ensure API key exists
        if (!GROQ_API_KEY) {
            const userKey = prompt("Будь ласка, введіть ваш Groq API Key для активації діалогів:");
            if (userKey) {
                GROQ_API_KEY = userKey;
                localStorage.setItem('sandbox3d_groq_key', userKey);
            } else {
                this.addMessageToLog("Система", "Діалоги відхилено: відсутній API ключ.");
                return;
            }
        }

        this.addMessageToLog(this.playerName, text);
        this.showTyping(true);

        const context = this.currentVillager.getSurroundingContext();
        const systemPrompt = `Ви — ${this.currentVillager.name}, ${this.currentVillager.isFemale ? 'жінка' : 'чоловік'}, живий мешканець цього процедурного світу Minecraft.
Ви не просто ШІ, а особистість з власними спостереженнями. Використовуйте навколишній контекст, щоб відповідати на конкретні запитання гравця.
Контекст:
- Час: ${context.timeOfDay}.
- Погода: ${context.weather}.
- Сезон: ${context.season}.
- Оточення: ${context.surroundings}.
- Співрозмовник: ${this.playerName}.

Ваші правила:
1. Відповідайте природно. Якщо гравець питає "Де ми?" або "Що ти бачиш?", опишіть місцевість та об'єкти з контексту вище.
2. Будьте привітні, але дійте відповідно до погоди та пори року. Наприклад, взимку ви можете скаржитись на холод, восени — згадувати про збір врожаю, а весною — радіти першим квітам.
3. Не використовуйте шаблонні фрази. Кожна відповідь має базуватися на тому, що запитав гравець.
4. Ви знаєте лише про цей світ (блоки, моби, ресурси). Не згадуйте про реальний світ або про те, що ви програма. Відповідайте українською мовою.`;

        if (GROQ_API_KEY === "ENV_KEY_MISSING") {
            this.showTyping(false);
            this.addMessageToLog("Система", "Помилка: API ключ Groq не знайдено у вашому оточенні (window.GROQ_API_KEY).");
            return;
        }

        try {
            const response = await fetch(PROXY_OR_DIRECT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...this.history.slice(-6),
                        { role: "user", content: text }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.choices[0].message.content;
            
            this.showTyping(false);
            this.addMessageToLog(this.currentVillager.name, aiText);
            this.speak(aiText);
            
            this.history.push({ role: "user", content: text });
            this.history.push({ role: "assistant", content: aiText });

        } catch (e) {
            console.error("Groq API Error:", e);
            this.showTyping(false);
            let msg = "Вибачте, житель задумався і не може відповісти.";
            if (e.message.includes("401")) msg = "Помилка: Недійсний API ключ (Unauthorized).";
            else if (e.message.includes("429")) msg = "Помилка: Ліміт запитів вичерпано (Rate limit).";
            
            this.addMessageToLog("Система", msg);
        }
    }

    speak(text) {
        if (!window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'uk-UA';
        
        const voice = this.currentVillager.isFemale ? ukrainianVoices.female : ukrainianVoices.male;
        if (voice) utterance.voice = voice;
        
        window.speechSynthesis.speak(utterance);
    }

    openDialogue(villager) {
        this.currentVillager = villager;
        this.currentVillager.isTalking = true;
        this.history = [];
        this.isUIOpen = true;
        
        const ui = document.getElementById('dialogue-ui');
        ui.style.display = 'block';
        document.getElementById('dialogue-name').textContent = villager.name;
        document.getElementById('dialogue-log').innerHTML = '';
        
        this.addMessageToLog("Система", `Ви розмовляєте з ${villager.name}. Натисніть 'Alt' щоб говорити голосом.`);
        
        // Auto-focus input
        setTimeout(() => document.getElementById('dialogue-input').focus(), 100);
    }

    closeDialogue() {
        this.isUIOpen = false;
        if (this.currentVillager) {
            this.currentVillager.isTalking = false;
            this.currentVillager = null;
        }
        document.getElementById('dialogue-ui').style.display = 'none';
        window.speechSynthesis.cancel();
    }

    addMessageToLog(sender, text) {
        const log = document.getElementById('dialogue-log');
        const div = document.createElement('div');
        div.innerHTML = `<strong>${sender}:</strong> ${text}`;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
    }

    showTyping(show) {
        const typing = document.getElementById('dialogue-typing');
        typing.style.display = show ? 'block' : 'none';
    }
}

export const dialogueService = new DialogueService();
