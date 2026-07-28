(function () {
  const forms = Array.isArray(window.BLOODLINE_APPLICATION_FORMS) ? window.BLOODLINE_APPLICATION_FORMS : [];
  const tabs = Array.from(document.querySelectorAll(".app-tab-btn"));
  const panels = Array.from(document.querySelectorAll(".app-tab-panel"));
  const formSelect = document.getElementById("applicationFormSelect");
  const builderForm = document.getElementById("applicationBuilderForm");
  const builderFields = document.getElementById("applicationBuilderFields");
  const builderMessage = document.getElementById("applicationBuilderMessage");

  const listByType = {
    server: document.getElementById("appTabListServer"),
    "public-safety": document.getElementById("appTabListPublicSafety"),
    "city-hall": document.getElementById("appTabListCityHall"),
    "business-gang": document.getElementById("appTabListBusinessGang"),
  };

  function setBuilderMessage(text, kind) {
    if (!builderMessage) {
      return;
    }

    builderMessage.textContent = text;
    builderMessage.classList.remove("error", "success");
    if (kind) {
      builderMessage.classList.add(kind);
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

  function groupFormsByType() {
    return forms.reduce((acc, form) => {
      const key = form.type || "server";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(form);
      return acc;
    }, {});
  }

  function fillTabPanels() {
    const grouped = groupFormsByType();

    Object.keys(listByType).forEach((type) => {
      const list = listByType[type];
      const countEl = document.querySelector('[data-app-count="' + type + '"]');
      const entries = grouped[type] || [];

      if (!list) {
        return;
      }

      list.innerHTML = "";
      entries.forEach((entry) => {
        const item = document.createElement("li");
        item.innerHTML = '<span>' + entry.title + "</span><span>Open</span>";
        list.appendChild(item);
      });

      if (countEl) {
        countEl.textContent = entries.length + " Open";
      }
    });
  }

  function switchTab(nextKey) {
    tabs.forEach((tab) => {
      const isActive = tab.getAttribute("data-app-tab") === nextKey;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      const isActive = panel.getAttribute("data-app-panel") === nextKey;
      panel.classList.toggle("is-active", isActive);
    });
  }

  function renderBuilderFields() {
    if (!formSelect || !builderFields) {
      return;
    }

    const selected = forms.find((form) => form.key === formSelect.value);
    if (!selected) {
      builderFields.innerHTML = "";
      return;
    }

    builderFields.innerHTML = "";

    selected.questions.forEach((question, index) => {
      const fieldWrap = document.createElement("div");
      fieldWrap.className = "app-field";

      const label = document.createElement("label");
      const fieldId = "appQuestion" + index;
      label.setAttribute("for", fieldId);
      label.textContent = question.label + (question.required ? " *" : "");

      let field;
      if (question.kind === "textarea") {
        field = document.createElement("textarea");
        field.rows = 4;
      } else if (question.kind === "yesno") {
        field = document.createElement("select");
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select one";
        const yesOption = document.createElement("option");
        yesOption.value = "Yes";
        yesOption.textContent = "Yes";
        const noOption = document.createElement("option");
        noOption.value = "No";
        noOption.textContent = "No";
        field.appendChild(defaultOption);
        field.appendChild(yesOption);
        field.appendChild(noOption);
      } else {
        field = document.createElement("input");
        field.type = "text";
      }

      field.id = fieldId;
      field.name = question.id;
      field.required = Boolean(question.required);
      field.setAttribute("data-question-label", question.label);

      fieldWrap.appendChild(label);
      fieldWrap.appendChild(field);
      builderFields.appendChild(fieldWrap);
    });
  }

  async function submitApplication(event) {
    event.preventDefault();

    if (!formSelect || !builderFields) {
      return;
    }

    const selectedForm = forms.find((form) => form.key === formSelect.value);
    if (!selectedForm) {
      setBuilderMessage("Please select a form first.", "error");
      return;
    }

    const fields = Array.from(builderFields.querySelectorAll("input, textarea, select"));
    const responses = [];

    for (const field of fields) {
      const value = (field.value || "").trim();
      if (field.required && !value) {
        field.focus();
        setBuilderMessage("Please complete all required fields.", "error");
        return;
      }

      responses.push({
        question: field.getAttribute("data-question-label") || field.name,
        answer: value,
      });
    }

    if (!isLoggedInLocally()) {
      setBuilderMessage("Log in through the account icon before submitting.", "error");
      const loginTrigger = document.querySelector(".login-trigger");
      if (loginTrigger) {
        loginTrigger.click();
      }
      return;
    }

    const bodyText = responses
      .filter((entry) => entry.answer)
      .map((entry) => entry.question + ": " + entry.answer)
      .join("\n");

    if (!bodyText) {
      setBuilderMessage("Application responses are required.", "error");
      return;
    }

    const payload = {
      formKey: selectedForm.key,
      type: selectedForm.type,
      title: selectedForm.title,
      body: bodyText,
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
        const data = await response.json().catch(function () { return {}; });
        setBuilderMessage(data.error || "Could not submit your application right now.", "error");
        return;
      }

      builderForm.reset();
      renderBuilderFields();
      setBuilderMessage("Application submitted. Staff will review it soon.", "success");
    } catch {
      setBuilderMessage("Could not reach the auth server. Try again shortly.", "error");
    }
  }

  function initBuilder() {
    if (!formSelect || !builderForm || !builderFields) {
      return;
    }

    formSelect.innerHTML = "";

    forms.forEach((form) => {
      const option = document.createElement("option");
      option.value = form.key;
      option.textContent = form.title;
      formSelect.appendChild(option);
    });

    if (forms.length > 0) {
      formSelect.value = forms[0].key;
      renderBuilderFields();
    } else {
      setBuilderMessage("No application forms are configured.", "error");
    }

    formSelect.addEventListener("change", renderBuilderFields);
    builderForm.addEventListener("submit", submitApplication);
  }

  function initTabs() {
    tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        const nextKey = tab.getAttribute("data-app-tab");
        if (!nextKey) {
          return;
        }
        switchTab(nextKey);
      });
    });
  }

  fillTabPanels();
  initTabs();
  initBuilder();
})();
