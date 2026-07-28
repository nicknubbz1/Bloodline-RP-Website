(function () {
  const forms = Array.isArray(window.BLOODLINE_APPLICATION_FORMS) ? window.BLOODLINE_APPLICATION_FORMS : [];
  const catalog = document.getElementById("applicationCatalog");

  const categoryMeta = {
    server: {
      title: "Server Applications",
      copy: "Moderation, allowlist, and core city operations.",
    },
    "public-safety": {
      title: "Public Safety",
      copy: "Police, EMS, and fire department roles.",
    },
    "city-hall": {
      title: "City Hall Applications",
      copy: "Government and legal branch opportunities.",
    },
    "business-gang": {
      title: "Business and Gang Applications",
      copy: "Official org applications for the city ecosystem.",
    },
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function groupFormsByType() {
    return forms.reduce(function (acc, form) {
      const key = form.type || "server";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(form);
      return acc;
    }, {});
  }

  function createCardMarkup(form) {
    const questionCount = Array.isArray(form.questions) ? form.questions.length : 0;
    const description = form.description || "Open application.";
    return ""
      + '<article class="app-directory-card">'
      + '<h4>' + escapeHtml(form.title) + '</h4>'
      + '<p>' + escapeHtml(description) + '</p>'
      + '<div class="app-directory-meta">'
      + '<span>' + questionCount + ' questions</span>'
      + '<span>Open</span>'
      + '</div>'
      + '<a class="btn btn-primary" href="application-view.html?form=' + encodeURIComponent(form.key) + '">Open Application</a>'
      + '</article>';
  }

  function renderCatalog() {
    if (!catalog) {
      return;
    }

    const grouped = groupFormsByType();
    const categoryOrder = ["server", "public-safety", "city-hall", "business-gang"];

    catalog.innerHTML = "";

    categoryOrder.forEach(function (type) {
      const entries = grouped[type] || [];
      const meta = categoryMeta[type] || {
        title: type,
        copy: "",
      };

      const section = document.createElement("section");
      section.className = "app-category-block";
      section.innerHTML = ""
        + '<header class="app-category-head">'
        + '<h3>' + escapeHtml(meta.title) + '</h3>'
        + '<p>' + escapeHtml(meta.copy) + '</p>'
        + '<span class="app-category-count">' + entries.length + ' Open</span>'
        + '</header>'
        + '<div class="app-category-cards"></div>';

      const cardsWrap = section.querySelector(".app-category-cards");
      if (cardsWrap) {
        cardsWrap.innerHTML = entries.map(createCardMarkup).join("");
      }

      catalog.appendChild(section);
    });

    if (!forms.length) {
      catalog.innerHTML = '<section class="app-category-block"><p>No application forms are configured.</p></section>';
    }
  }
  renderCatalog();
})();
