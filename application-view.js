(function () {
  const forms = Array.isArray(window.BLOODLINE_APPLICATION_FORMS) ? window.BLOODLINE_APPLICATION_FORMS : [];
  const titleEl = document.getElementById("appViewTitle");
  const descriptionEl = document.getElementById("appViewDescription");
  const categoryEl = document.getElementById("appViewCategory");
  const questionTotalEl = document.getElementById("appViewQuestionTotal");
  const fieldsWrap = document.getElementById("applicationViewFields");
  const formEl = document.getElementById("applicationViewForm");
  const messageEl = document.getElementById("applicationViewMessage");

  const categoryNames = {
    server: "Server",
    "public-safety": "Public Safety",
    "city-hall": "City Hall",
    "business-gang": "Business/Gang",
  };

  const params = new URLSearchParams(window.location.search);
  const formKey = params.get("form") || "";
  const selectedForm = forms.find(function (entry) {
    return entry.key === formKey;
  });

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

  function isLoggedInLocally() {
    try {
      const state = JSON.parse(localStorage.getItem("bloodline-account") || "{}");
      return Boolean(state.steamId || state.steamName);
    } catch {
      return false;
    }
  }

  function renderField(question, index) {
    const wrap = document.createElement("div");
    wrap.className = "app-view-field";

    const label = document.createElement("label");
    const id = "viewQuestion" + index;
    label.setAttribute("for", id);
    label.textContent = question.label + (question.required ? " *" : "");

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
      if (categoryEl) {
        categoryEl.textContent = "Unknown";
      }
      if (questionTotalEl) {
        questionTotalEl.textContent = "0";
      }
      return;
    }

    titleEl.textContent = selectedForm.title;
    descriptionEl.textContent = selectedForm.description || "Complete each question below and submit when ready.";
    if (categoryEl) {
      categoryEl.textContent = categoryNames[selectedForm.type] || "Server";
    }
    if (questionTotalEl) {
      questionTotalEl.textContent = String(Array.isArray(selectedForm.questions) ? selectedForm.questions.length : 0);
    }
    fieldsWrap.innerHTML = "";

    selectedForm.questions.forEach(function (question, index) {
      fieldsWrap.appendChild(renderField(question, index));
    });
  }

  async function submit(event) {
    event.preventDefault();

    if (!selectedForm || !fieldsWrap) {
      return;
    }

    const fields = Array.from(fieldsWrap.querySelectorAll("input, textarea, select"));
    const responses = [];

    for (const field of fields) {
      const value = (field.value || "").trim();
      if (field.required && !value) {
        field.focus();
        setMessage("Please complete all required fields.", "error");
        return;
      }

      responses.push({
        question: field.getAttribute("data-question-label") || field.name,
        answer: value,
      });
    }

    if (!isLoggedInLocally()) {
      setMessage("Log in through the account icon before submitting.", "error");
      const loginTrigger = document.querySelector(".login-trigger");
      if (loginTrigger) {
        loginTrigger.click();
      }
      return;
    }

    const body = responses
      .filter(function (entry) {
        return entry.answer;
      })
      .map(function (entry) {
        return entry.question + ": " + entry.answer;
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
        const data = await response.json().catch(function () {
          return {};
        });
        setMessage(data.error || "Could not submit your application right now.", "error");
        return;
      }

      if (formEl) {
        formEl.reset();
      }
      setMessage("Application submitted. Staff will review it soon.", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setMessage("Could not reach the auth server. Try again shortly.", "error");
    }
  }

  renderForm();
  if (formEl) {
    formEl.addEventListener("submit", submit);
  }
})();
