(() => {
  "use strict";

  const get = id => document.getElementById(id);
  const gate = get("teacherUnlock");
  const passwordInput = get("teacherPassword");
  const message = get("teacherMessage");
  const content = get("teacherContent");
  const selector = get("teacherTopic");
  const picked = get("teacherPicked");
  const questions = get("teacherQuestions");
  let topics = null;
  let lastPick = -1;

  const bytes = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

  async function decodeBank(password) {
    const response = await fetch("./teacher-bank.enc.json");
    if (!response.ok) throw new Error("Банк не загрузился. Попробуйте ещё раз.");
    const encrypted = await response.json();
    const material = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey({
      name: "PBKDF2", salt: bytes(encrypted.salt), iterations: 600000, hash: "SHA-256"
    }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let plain;
    try {
      plain = await crypto.subtle.decrypt({
        name: "AES-GCM", iv: bytes(encrypted.iv)
      }, key, bytes(encrypted.data));
    } catch {
      throw new Error("Неверный пароль.");
    }
    const decoded = new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(decoded).json();
  }

  function line(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
  }

  function questionCard(topic, question) {
    const card = document.createElement("article");
    card.className = "teacher-question";
    const tag = line("small", question.id + " · " + question.section);
    tag.className = "muted";
    const details = document.createElement("details");
    details.append(
      line("summary", "Ориентир для ответа"),
      line("p", question.answer),
      line("small", topic.source + " · " + (/^(Кн\.|РПД)/.test(question.pages) ? "" : "с. ") + question.pages)
    );
    card.append(tag, line("h3", question.prompt), details);
    return card;
  }

  function showTopic() {
    const topic = topics[Number(selector.value)];
    lastPick = -1;
    picked.replaceChildren();
    get("teacherCount").textContent = "Вопросов в теме: " + topic.questions.length;
    questions.replaceChildren(...topic.questions.map(question => questionCard(topic, question)));
  }

  gate.addEventListener("submit", async event => {
    event.preventDefault();
    const button = get("teacherSubmit");
    if (button.disabled) return;
    message.textContent = "";
    const password = passwordInput.value.trim();
    passwordInput.value = "";
    if (!password) return;
    if (!globalThis.crypto?.subtle || typeof DecompressionStream !== "function") {
      message.textContent = "Откройте банк по HTTPS в современном браузере.";
      return;
    }
    button.disabled = true;
    try {
      topics = await decodeBank(password);
      selector.replaceChildren(...topics.map((topic, index) => {
        const option = line("option", topic.id + ". " + topic.title);
        option.value = String(index);
        return option;
      }));
      selector.value = "0";
      showTopic();
      gate.hidden = true;
      content.hidden = false;
      selector.focus();
    } catch (error) {
      message.textContent = error.message || "Не удалось открыть банк.";
      passwordInput.focus();
    } finally {
      button.disabled = false;
    }
  });

  selector.addEventListener("change", showTopic);
  get("teacherRandom").addEventListener("click", () => {
    const topic = topics[Number(selector.value)];
    const count = topic.questions.length;
    let index = Math.floor(Math.random() * (lastPick >= 0 && count > 1 ? count - 1 : count));
    if (lastPick >= 0 && count > 1 && index >= lastPick) index++;
    lastPick = index;
    picked.replaceChildren(questionCard(topic, topic.questions[index]));
  });
  get("teacherLock").addEventListener("click", () => {
    topics = null;
    lastPick = -1;
    selector.replaceChildren();
    picked.replaceChildren();
    questions.replaceChildren();
    get("teacherCount").textContent = "";
    content.hidden = true;
    gate.hidden = false;
    passwordInput.focus();
  });
})();
