const API_URL = "http://127.0.0.1:8000";

// --- ACTUALIZAR FOTO DE CABECERA GLOBAL ---
    const sessionUserId = localStorage.getItem('vnk_user_id');
    const sessionProfilePic = localStorage.getItem('vnk_profile_pic');

    if (sessionProfilePic && sessionProfilePic !== "null") {
        // Si la foto está en la memoria, la ponemos de inmediato
        $('.top-bar .profile-img').attr('src', sessionProfilePic);
    } else if (sessionUserId && sessionUserId !== '999') {
        // Si no está en memoria pero el usuario inició sesión, consultamos a la API
        $.ajax({ url: `${API_URL}/users/${sessionUserId}`, type: 'GET' })
         .done(function(user) {
             if (user.profile_pic_url) {
                 localStorage.setItem('vnk_profile_pic', user.profile_pic_url);
                 $('.top-bar .profile-img').attr('src', user.profile_pic_url);
             }
         });
    }

// PRUEBA DE VIDA: Esto DEBE aparecer en la consola F12 nada más abrir la página
console.log(" El archivo register.js está conectado y funcionando.");

$(document).ready(function() {
    $('#mi-formulario-registro').on('submit', async function(event) {
        event.preventDefault(); // Esto "mata" la recarga de la página
        
        console.log("⏳ Botón presionado. Iniciando registro...");
        
        const email = $('#reg-email').val();
        const password = $('#reg-password').val();
        const edad = parseInt($('#reg-age').val());
        
        if (edad <= 13) {
            alert("Debes tener más de 13 años para registrarte en VNKMedia.");
            return; 
        }
        
        try {
            const response = await $.ajax({
                url: `${API_URL}/register/`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    username: email,
                    password: password
                })
            });
            
            console.log("Registro exitoso en la Base de Datos!");
            alert("¡Cuenta creada con éxito! Ahora inicia sesión.");
            window.location.href = "login.html";
            
        } catch (error) {
            console.error(" Error devuelto por la API:", error);
            const mensajeError = error.responseJSON?.detail || "Hubo un error al registrarse";
            alert(mensajeError);
        }
    });
});