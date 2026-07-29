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

  function formatOpenCount(count) {
    if (count === 1) {
      return "1 Open Form";
    }
    return count + " Open Forms";
  }

  function createCardMarkup(form) {
    const questionCount = Array.isArray(form.questions) ? form.questions.length : 0;
    const description = form.description || "Open application.";
    return ""
      + '<article class="app-directory-item">'
      + '<div class="app-directory-item-main">'
      + '<h4 class="app-directory-title">' + escapeHtml(form.title) + '</h4>'
      + '<p class="app-directory-description">' + escapeHtml(description) + '</p>'
      + '</div>'
      + '<div class="app-directory-item-side">'
      + '<span class="app-directory-questions">' + questionCount + ' questions</span>'
      + '<span class="app-directory-status">Open</span>'
      + '<a class="btn btn-primary app-directory-open-btn" href="application-view.html?form=' + encodeURIComponent(form.key) + '">Start</a>'
      + '</div>'
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
        + '<span class="app-category-count">' + formatOpenCount(entries.length) + '</span>'
        + '</header>'
        + '<div class="app-category-cards"></div>';

      const cardsWrap = section.querySelector(".app-category-cards");
      if (cardsWrap) {
        cardsWrap.innerHTML = entries.length
          ? entries.map(createCardMarkup).join("")
          : '<article class="app-directory-item app-directory-item-empty"><p>No forms are currently open in this category.</p></article>';
      }

      catalog.appendChild(section);
    });

    if (!forms.length) {
      catalog.innerHTML = '<section class="app-category-block"><p>No application forms are configured.</p></section>';
    }
  }
  renderCatalog();
})();
