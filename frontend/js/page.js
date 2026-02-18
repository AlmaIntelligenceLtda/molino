class Page {
  constructor(user) {
    this.user = user;
    this.attachEvents();
    this.loadDataUser();
  }

  get(id) {
    return document.querySelector(id);
  }

  setElementValue(selector, property, value) {
    const el = this.get(selector);
    if (el) el[property] = value;
  }

  attachEvents() {
    this.get('#btnLogout')?.addEventListener('click', this.logout.bind(this));
  }

  async logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
    } catch (err) {
      console.error("❌ Error al cerrar sesión:", err);
    } finally {
      // 🔒 Redirigir siempre a login y bloquear "atrás"
      window.location.replace("login.html");
    }
  }

  loadDataUser() {
    const { nombres, apellidos, email, rol } = this.user;

    // Set datos en el header
    [
      ['#profileNameInicio', 'innerHTML', nombres + " " + apellidos],
      ['#profileNombre', 'innerHTML', nombres + " " + apellidos],
      ['#profileEmail', 'innerHTML', email],
      ['#nombreUsuarioDashboard', 'innerHTML', nombres + " " + apellidos]
    ].forEach(([selector, prop, val]) => this.setElementValue(selector, prop, val));

    // Ocultar todos los menús y tarjetas por defecto
    [
      ...document.querySelectorAll('.nav-menu'),
      ...document.querySelectorAll('.nav-category'),
      ...document.querySelectorAll('.card-dashboard')
    ].forEach(el => el.style.display = 'none');

    // Mostrar elementos autorizados por rol
    this.mostrarElementosPorRol(rol);
  }

  mostrarElementosPorRol(rol) {
    const elementosPorRol = {
      administrador: [
        ['#menuUsuarios', '#cardUsuarios'],
        ['#menuCompany', '#cardCompany'],
        ['#menuAsignaciones', '#cardAsignaciones'],
        ['#menuClientes', '#cardClientes'],
        ['#menuCuentaCorriente', '#cardCuentaCorriente'],
        ['#menuMaquila', '#cardMaquila'],
        ['#menuBodegas', '#cardBodegas'],
        ['#menuRecepcion', '#cardRecepcion'],
        ['#menuLaboratorio', '#cardLaboratorio'],
        ['#menuProduccion', '#cardProduccion'],
        ['#menuMantenedores', '#cardMantenedores'],
      ],
      superusuario: [
        // 👑 acceso a todo
        ['#menuUsuarios', '#cardUsuarios'],
        ['#menuCompany', '#cardCompany'],
        ['#menuAsignaciones', '#cardAsignaciones'],
        ['#menuClientes', '#cardClientes'],
        ['#menuCuentaCorriente', '#cardCuentaCorriente'],
        ['#menuMaquila', '#cardMaquila'],
        ['#menuBodegas', '#cardBodegas'],
        ['#menuRecepcion', '#cardRecepcion'],
        ['#menuLaboratorio', '#cardLaboratorio'],
        ['#menuProduccion', '#cardProduccion'],
        ['#menuMantenedores', '#cardMantenedores'],
      ],
      operador: [
        ['#menuRecepcion', '#cardRecepcion'],
        ['#menuMaquila', '#cardMaquila'],
        ['#menuBodegas', '#cardBodegas']
      ],
      analista: [
        ['#menuRecepcion', '#cardRecepcion'],
        ['#menuLaboratorio', '#cardLaboratorio'],
      ],
      vendedor: [
        ['#menuMaquila', '#cardMaquila'],
      ]
    };

    const pares = elementosPorRol[rol] || [];

    pares.forEach(([menuId, cardId]) => {
      const menuEl = document.querySelector(menuId);
      const cardEl = document.querySelector(cardId);
      if (menuEl) menuEl.style.display = '';
      if (cardEl) cardEl.style.display = '';
    });

    // Mostrar las categorías del menú si tienen ítems visibles
    document.querySelectorAll('.nav-category').forEach(category => {
      let siguiente = category.nextElementSibling;
      while (siguiente && !siguiente.classList.contains('nav-category')) {
        if (siguiente.style.display !== 'none') {
          category.style.display = '';
          break;
        }
        siguiente = siguiente.nextElementSibling;
      }
    });

    feather.replace();
  }
}
