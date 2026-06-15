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

$(document).ready(function() {
    
    $('#loginForm form').on('submit', async function(event) {
        event.preventDefault(); 
        
        const email = $('#login-email').val();
        const password = $('#login-password').val();
        
        try {
            const response = await $.ajax({
                url: `${API_URL}/login/`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    username: email,
                    password: password
                })
            });
            localStorage.setItem('vnk_user_id', response.user_id);
            localStorage.setItem('vnk_username', response.username);
            
            window.location.href = "index.html";
            
        } catch (error) {
            console.error("Error en login:", error);
            alert("Usuario o contraseña incorrectos. Por favor, intenta de nuevo.");
        }
    }); 
    $('#btn-invitado').on('click', function(event) {
        event.preventDefault(); 

        localStorage.removeItem('vnk_user_id');
        localStorage.removeItem('vnk_username');
        localStorage.removeItem('vnk_profile_pic');
        window.location.href = "index.html";
    });

});