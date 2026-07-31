(function () {
  const forms = Array.isArray(window.BLOODLINE_APPLICATION_FORMS) ? window.BLOODLINE_APPLICATION_FORMS : [];
  const titleEl = document.getElementById("appViewTitle");
  const descriptionEl = document.getElementById("appViewDescription");
  const questionTotalEl = document.getElementById("appViewQuestionTotal");
  const fieldsWrap = document.getElementById("applicationViewFields");
  const formEl = document.getElementById("applicationViewForm");
  const messageEl = document.getElementById("applicationViewMessage");
  const loginPopupEl = document.getElementById("loginRequiredPopup");
  const loginPopupCloseEl = document.getElementById("loginRequiredPopupClose");
  const loginPopupLoginEl = document.getElementById("loginRequiredPopupLogin");
  const localApplicationAvailabilityKey = "bloodline-application-form-availability";
  const applicationDraftStoragePrefix = "bloodline-application-draft";

  const params = new URLSearchParams(window.location.search);
  const formKey = params.get("form") || "";
  const selectedForm = forms.find(function (entry) {
    return entry.key === formKey;
  });

  function readApplicationAvailability() {
    try {
      return JSON.parse(localStorage.getItem(localApplicationAvailabilityKey) || "{}") || {};
    } catch {
      return {};
    }
  }

  function isSelectedFormOpen() {
    if (!selectedForm?.key) {
      return false;
    }
    const map = readApplicationAvailability();
    if (map[selectedForm.key] === undefined) {
      return true;
    }
    return Boolean(map[selectedForm.key]);
  }

  function getDraftStorageKey() {
    if (!selectedForm?.key) {
      return "";
    }
    return `${applicationDraftStoragePrefix}:${selectedForm.key}`;
  }

  function readDraft() {
    const key = getDraftStorageKey();
    if (!key) {
      return {};
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}") || {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDraft(nextDraft) {
    const key = getDraftStorageKey();
    if (!key) {
      return;
    }

    const safeDraft = nextDraft && typeof nextDraft === "object" ? nextDraft : {};
    localStorage.setItem(key, JSON.stringify(safeDraft));
  }

  function clearDraft() {
    const key = getDraftStorageKey();
    if (!key) {
      return;
    }
    localStorage.removeItem(key);
  }

  function getFormFields() {
    if (!fieldsWrap) {
      return [];
    }
    return Array.from(fieldsWrap.querySelectorAll("input, textarea, select"));
  }

  function persistDraftFromFields() {
    const fields = getFormFields();
    if (!fields.length) {
      return;
    }

    const nextDraft = {};
    fields.forEach(function (field) {
      const fieldName = String(field.name || "").trim();
      if (!fieldName) {
        return;
      }
      nextDraft[fieldName] = String(field.value || "");
    });
    writeDraft(nextDraft);
  }

  function restoreDraftToFields() {
    const draft = readDraft();
    const fields = getFormFields();
    if (!fields.length) {
      return;
    }

    fields.forEach(function (field) {
      const fieldName = String(field.name || "").trim();
      if (!fieldName) {
        return;
      }

      const savedValue = draft[fieldName];
      if (typeof savedValue === "string") {
        field.value = savedValue;
      }
    });
  }

  function setMessage(text, kind) {
    if (!messageEl) {
      return;
    }

    messageEl.textContent = text;
    messageEl.classList.remove("error", "success");
    if (kind) {
      messageEl.classList.add(kind);
    }
  }

  function getApiBaseUrl() {
    const sessionUrl = window.BLOODLINE_AUTH_SESSION_URL || "http://localhost:3000/auth/session";
    try {
      return new URL(sessionUrl).origin + "/api";
    } catch {
      return "http://localhost:3000/api";
    }
  }

  function getAuthSessionUrl() {
    return window.BLOODLINE_AUTH_SESSION_URL || "http://localhost:3000/auth/session";
  }

  function readLocalAccountState() {
    try {
      return JSON.parse(localStorage.getItem("bloodline-account") || "{}") || {};
    } catch {
      return {};
    }
  }

  function isLoggedInLocally() {
    const state = readLocalAccountState();
    return Boolean(String(state.steamId || "").trim());
  }

  function hasLinkedDiscordLocally() {
    const state = readLocalAccountState();
    return Boolean(
      String(state.discordId || "").trim()
      || String(state.discordName || "").trim()
      || String(state.discordUsername || "").trim()
    );
  }

  async function getBackendLinkState() {
    try {
      const response = await fetch(getAuthSessionUrl(), {
        credentials: "include",
      });

      if (!response.ok) {
        return {
          reachable: true,
          unauthorized: response.status === 401 || response.status === 403,
          hasSteam: false,
          hasDiscord: false,
        };
      }

      const payload = await response.json();
      const account = payload && payload.account ? payload.account : {};
      return {
        reachable: true,
        unauthorized: false,
        hasSteam: Boolean(String(account.steamId || "").trim()),
        hasDiscord: Boolean(
          String(account.discordId || "").trim()
          || String(account.discordName || "").trim()
          || String(account.discordUsername || "").trim()
        ),
      };
    } catch {
      return {
        reachable: false,
        unauthorized: false,
        hasSteam: false,
        hasDiscord: false,
      };
    }
  }

  function showLoginRequiredPopup() {
    if (!loginPopupEl) {
      return;
    }
    loginPopupEl.hidden = false;
  }

  function hideLoginRequiredPopup() {
    if (!loginPopupEl) {
      return;
    }
    loginPopupEl.hidden = true;
  }

  function renderField(question, index) {
    const wrap = document.createElement("div");
    wrap.className = "app-view-field";

    const label = document.createElement("label");
    const id = "viewQuestion" + index;
    label.setAttribute("for", id);
    label.textContent = question.label;

    let input;
    if (question.kind === "textarea") {
      input = document.createElement("textarea");
      input.rows = 5;
    } else if (question.kind === "yesno") {
      input = document.createElement("select");
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "Select one";
      const yes = document.createElement("option");
      yes.value = "Yes";
      yes.textContent = "Yes";
      const no = document.createElement("option");
      no.value = "No";
      no.textContent = "No";
      input.appendChild(none);
      input.appendChild(yes);
      input.appendChild(no);
    } else {
      input = document.createElement("input");
      input.type = "text";
    }

    input.id = id;
    input.name = question.id;
    input.required = Boolean(question.required);
    input.setAttribute("data-question-label", question.label);

    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  function renderForm() {
    if (!selectedForm || !fieldsWrap || !titleEl || !descriptionEl) {
      if (titleEl) {
        titleEl.textContent = "Application Not Found";
      }
      if (descriptionEl) {
        descriptionEl.textContent = "This application does not exist anymore. Return to the applications directory.";
      }
      if (fieldsWrap) {
        fieldsWrap.innerHTML = "";
      }
      if (formEl) {
        formEl.hidden = true;
      }
      if (questionTotalEl) {
        questionTotalEl.textContent = "0";
      }
      return;
    }

    if (!isSelectedFormOpen()) {
      titleEl.textContent = selectedForm.title;
      descriptionEl.textContent = "This application is currently closed. Please check back later.";
      if (fieldsWrap) {
        fieldsWrap.innerHTML = "";
      }
      if (formEl) {
        formEl.hidden = true;
      }
      if (questionTotalEl) {
        questionTotalEl.textContent = "0";
      }
      return;
    }

    titleEl.textContent = selectedForm.title;
    descriptionEl.textContent = selectedForm.description || "Complete each question below and submit when ready.";
    if (questionTotalEl) {
      questionTotalEl.textContent = String(Array.isArray(selectedForm.questions) ? selectedForm.questions.length : 0);
    }
    fieldsWrap.innerHTML = "";

    selectedForm.questions.forEach(function (question, index) {
      fieldsWrap.appendChild(renderField(question, index));
    });

    restoreDraftToFields();
  }

  async function submit(event) {
    event.preventDefault();

    if (!selectedForm || !fieldsWrap) {
      return;
    }

    if (!isSelectedFormOpen()) {
      setMessage("This application is currently closed.", "error");
      return;
    }

    const localHasSteam = isLoggedInLocally();
    const localHasDiscord = hasLinkedDiscordLocally();
    const backendLinkState = await getBackendLinkState();

    if (backendLinkState.reachable && backendLinkState.unauthorized) {
      setMessage("Your session expired. Please log in with Steam again, then resubmit.", "error");
      showLoginRequiredPopup();
      return;
    }

    if (backendLinkState.reachable) {
      if (!backendLinkState.hasSteam) {
        setMessage("Please log in with Steam, then try again.", "error");
        showLoginRequiredPopup();
        return;
      }

      if (!backendLinkState.hasDiscord) {
        setMessage("Please link Discord from your dashboard before submitting.", "error");
        return;
      }
    } else {
      if (!localHasSteam) {
        showLoginRequiredPopup();
        return;
      }

      if (!localHasDiscord) {
        setMessage("Please link Discord from your dashboard before submitting.", "error");
        return;
      }
    }

    const fields = Array.from(fieldsWrap.querySelectorAll("input, textarea, select"));
    const responses = [];

    for (const field of fields) {
      const value = (field.value || "").trim();
      if (field.required && !value) {
        setMessage("You did not fill out all required questions.", "error");
        return;
      }

      responses.push({
        id: field.name,
        label: field.getAttribute("data-question-label") || field.name,
        answer: value,
      });
    }

    const body = responses
      .filter(function (entry) {
        return entry.answer;
      })
      .map(function (entry) {
        return entry.label + ": " + entry.answer;
      })
      .join("\n");

    if (!body) {
      setMessage("Application responses are required.", "error");
      return;
    }

    const payload = {
      formKey: selectedForm.key,
      type: selectedForm.type,
      title: selectedForm.title,
      body,
      responses,
    };

    try {
      const response = await fetch(getApiBaseUrl() + "/applications", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setMessage("Your session expired. Please log in with Steam again, then resubmit.", "error");
          showLoginRequiredPopup();
          return;
        }
        const data = await response.json().catch(function () {
          return {};
        });
        setMessage(data.error || "Could not submit your application right now.", "error");
        return;
      }

      if (formEl) {
        formEl.reset();
      }
      clearDraft();
      setMessage("Application submitted. Staff will review it soon. You can view your application status in the dashboard.", "success");
    } catch {
      setMessage("Could not reach the auth server. Try again shortly.", "error");
    }
  }

  renderForm();
  if (loginPopupCloseEl) {
    loginPopupCloseEl.addEventListener("click", hideLoginRequiredPopup);
  }
  if (loginPopupLoginEl) {
    loginPopupLoginEl.addEventListener("click", function () {
      hideLoginRequiredPopup();
      const loginTrigger = document.querySelector(".login-trigger");
      if (loginTrigger) {
        loginTrigger.click();
      }
    });
  }
  if (formEl) {
    formEl.addEventListener("submit", submit);
    formEl.addEventListener("input", persistDraftFromFields);
    formEl.addEventListener("change", persistDraftFromFields);
  }
})();
