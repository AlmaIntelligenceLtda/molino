function includeHTML() {
  return new Promise((resolve) => {
    const includes = document.querySelectorAll("[data-include]");
    let total = includes.length;
    if (total === 0) return resolve();

    includes.forEach(async el => {
      const file = el.getAttribute("data-include");
      try {
        const res = await fetch(file);
        if (!res.ok) throw new Error("404");
        const html = await res.text();
        el.innerHTML = html;
        if (window.feather) feather.replace();
      } catch (err) {
        el.innerHTML = `<p style="color:red">No se pudo cargar ${file}</p>`;
      } finally {
        total--;
        if (total === 0) resolve();
      }
    });
  });
}
