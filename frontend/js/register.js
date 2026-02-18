const registerForm = document.getElementById('registerForm');
const errorText = document.getElementById('text-error');

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    register();
});

const register = async () => {
    const razonSocial = document.getElementById('txtRazonSocial').value.trim();
    const rutEmpresa = document.getElementById('txtRutEmpresa').value.trim();
    const nombresAdmin = document.getElementById('txtNombreAdmin').value.trim();
    const apellidosAdmin = document.getElementById('txtApellidoAdmin').value.trim();
    const emailAdmin = document.getElementById('txtEmailAdmin').value.trim();
    const password = document.getElementById('txtPassword').value.trim();

    if (!razonSocial || !rutEmpresa || !nombresAdmin || !emailAdmin || !password) {
        errorText.textContent = "Por favor completa todos los campos obligatorios.";
        return;
    }

    try {
        // Show loading state
        const btn = document.getElementById('btnRegister');
        const originalText = btn.textContent;
        btn.textContent = "Procesando...";
        btn.disabled = true;

        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                razonSocial,
                rutEmpresa,
                nombresAdmin,
                apellidosAdmin,
                emailAdmin,
                password
            })
        });

        const result = await res.json();

        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Registro Exitoso',
                text: 'Tu empresa ha sido creada. Ahora puedes iniciar sesión.',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                window.location.href = 'login.html';
            });
        } else {
            errorText.textContent = result.message || "Error al registrar.";
            btn.textContent = originalText;
            btn.disabled = false;
        }

    } catch (error) {
        console.error(error);
        errorText.textContent = "Error de conexión.";
        document.getElementById('btnRegister').disabled = false;
        document.getElementById('btnRegister').textContent = "Registrar y Acceder";
    }
};
