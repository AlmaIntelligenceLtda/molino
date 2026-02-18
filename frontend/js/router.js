document.addEventListener("DOMContentLoaded", () => {
  const contenedor = document.querySelector(".page-content");

  document.body.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-page]");
    if (!target) {
      return;
    }

    e.preventDefault();
    const page = target.getAttribute("data-page");

    try {
      const fetchUrl = `../views/${page}.html`;

      const res = await fetch(fetchUrl);

      const html = await res.text();

      contenedor.innerHTML = html;

      if (window.feather) {
        requestAnimationFrame(() => feather.replace());
      }

      // Sidebar: desmarcar todo
      document.querySelectorAll(".nav-item.nav-menu").forEach(item =>
        item.classList.remove("active")
      );

      // Sidebar: marcar si corresponde
      const matchingSidebarItem = document.querySelector(
        `.nav-item.nav-menu .nav-link[data-page="${page}"]`
      );
      if (matchingSidebarItem) {
        matchingSidebarItem.closest(".nav-item.nav-menu").classList.add("active");
      } else {
        console.log(`⚠️ No se encontró item de sidebar con data-page="${page}"`);
      }

      // Cargar JS asociado si existe
      const scriptPath = `./js/${page}.js`;

      fetch(scriptPath, { method: 'HEAD' })
        .then(res => {
          if (res.ok) {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.type = 'text/javascript';
            script.defer = true;
            document.body.appendChild(script);
          } else {
            console.log(`🚫 Script no encontrado: ${scriptPath}`);
          }
        })
        .catch(err => {
          console.log(`❌ Error HEAD a ${scriptPath}:`, err);
        });

    } catch (err) {
      contenedor.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar componente: <strong>${page}</strong>
        </div>`;
      console.error(`❌ Error cargando vista: ${page}`, err);
    }
  });
});
