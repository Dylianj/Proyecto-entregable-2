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
    // 1. Identificamos quién está navegando y qué perfil quiere ver
    const urlParams = new URLSearchParams(window.location.search);
    let profileUserId = urlParams.get('id'); // ID del perfil que estamos viendo
    const loggedInUserId = localStorage.getItem('vnk_user_id'); // ID del usuario en sesión

    // Si no se especifica un ID en la URL, asumimos que quiere ver su propio perfil
    if (!profileUserId) {
        profileUserId = loggedInUserId;
    }

    // Si no hay nadie logueado y tampoco se busca un perfil específico, al login
    if (!profileUserId) {
        window.location.href = "login.html";
        return;
    }

    // --- PROTECCIÓN DE SEGURIDAD INTERFAZ ---
    // Si el perfil que estoy viendo NO es el mío, escondo los botones de edición y logout
    if (profileUserId !== loggedInUserId) {
        $('#btn-edit-toggle').hide();
        $('#btn-logout').hide();
        $('#tab-saved-btn').hide(); // Un usuario no debería ver las fotos guardadas de otro de forma privada
    }

    // Colocar la foto del usuario en sesión en la barra superior
    const myProfilePic = localStorage.getItem('vnk_profile_pic');
    if (myProfilePic && $('#header-profile-img').length > 0) {
        $('#header-profile-img').attr('src', myProfilePic);
    }

    // --- CARGAR DATOS DEL PERFIL ---
    async function cargarPerfil() {
        try {
            const user = await $.ajax({ url: `${API_URL}/users/${profileUserId}`, type: 'GET' });
            
            $('#profile-display-name').text(user.display_name);
            $('#profile-email').text("@" + user.username.split("@")[0]);
            $('#input-new-name').val(user.display_name); 

            // Si el usuario tiene una foto guardada en la BDD, la cargamos, si no, dejamos el gato por defecto
            if (user.profile_pic_url) {
                $('#profile-avatar').attr('src', user.profile_pic_url);
                // Si es su propio perfil, actualizamos la miniatura del header
                if (profileUserId === loggedInUserId) {
                    localStorage.setItem('vnk_profile_pic', user.profile_pic_url);
                    $('#header-profile-img').attr('src', user.profile_pic_url);
                }
            }
        } catch (e) { 
            console.error("Error al obtener perfil"); 
            $('#profile-display-name').text("Usuario Desconocido");
        }
    }

    // --- CARGAR PINES CREADOS POR ESTE PERFIL ---
    async function cargarPinesDelUsuario() {
        const $grid = $('#user-pins-grid');
        $grid.empty();
        try {
            const posts = await $.ajax({ url: `${API_URL}/users/${profileUserId}/posts`, type: 'GET' });
            if (posts.length === 0) {
                $grid.append('<p style="grid-column: 1/-1; text-align: center; color: #767676;">Aún no hay Pines creados por este usuario.</p>');
                return;
            }
            posts.forEach(post => {
                $grid.append(`
                    <div class="pin-card" onclick="window.location.href='detalle.html?id=${post.id}'" style="cursor: pointer;">
                        <img src="${post.image_url}" alt="${post.title}">
                        <div style="padding: 10px;">
                            <h3 style="font-size: 14px; margin: 0; color: #333;">${post.title}</h3>
                        </div>
                    </div>
                `);
            });
        } catch (e) { console.error("Error al cargar los pines creados"); }
    }

    // --- CARGAR PINES GUARDADOS POR ESTE PERFIL ---
    async function cargarPinesGuardados() {
        const $grid = $('#user-pins-grid');
        $grid.empty();
        try {
            const savedPosts = await $.ajax({ url: `${API_URL}/users/${profileUserId}/saved_posts`, type: 'GET' });
            if (savedPosts.length === 0) {
                $grid.append('<p style="grid-column: 1/-1; text-align: center; color: #767676;">Aún no tienes Pines guardados.</p>');
                return;
            }
            savedPosts.forEach(post => {
                $grid.append(`
                    <div class="pin-card" onclick="window.location.href='detalle.html?id=${post.id}'" style="cursor: pointer;">
                        <img src="${post.image_url}" alt="${post.title}">
                        <div style="padding: 10px;">
                            <h3 style="font-size: 14px; margin: 0; color: #333;">${post.title}</h3>
                        </div>
                    </div>
                `);
            });
        } catch (e) { console.error("Error al cargar los pines guardados", e); }
    }

    // --- EVENTOS DE INTERFAZ ---
    $('.tab-btn').on('click', function() {
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');
        if ($(this).text().trim() === 'Guardados') {
            cargarPinesGuardados();
        } else {
            cargarPinesDelUsuario();
        }
    });

    $('#btn-edit-toggle').on('click', function() {
        $('#view-profile-box').hide();
        $('#edit-profile-form').fadeIn(200);
    });

    $('#btn-cancel-edit').on('click', function() {
        $('#edit-profile-form').hide();
        $('#view-profile-box').fadeIn(200);
    });

    // --- GUARDAR CAMBIOS (NOMBRE + FOTO AVATAR) ---
    $('#btn-save-profile').on('click', async function() {
        const nuevoNombre = $('#input-new-name').val().trim();
        if (!nuevoNombre) return;

        const $btn = $(this);
        $btn.text('...').prop('disabled', true);

        try {
            // 1. Guardar el nuevo nombre visible (PATCH)
            await $.ajax({
                url: `${API_URL}/users/${profileUserId}`,
                type: 'PATCH',
                contentType: 'application/json',
                data: JSON.stringify({ display_name: nuevoNombre })
            });

            // 2. Verificar si seleccionó un archivo de foto nuevo para subirlo
            const fileInput = $('#input-new-avatar')[0];
            if (fileInput.files && fileInput.files[0]) {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);

                await $.ajax({
                    url: `${API_URL}/users/${profileUserId}/avatar`,
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false
                });
            }

            alert("¡Perfil actualizado con éxito!");
            $('#edit-profile-form').hide();
            $('#view-profile-box').fadeIn(200);
            
            // Limpiar campo de archivo e inicializar de nuevo con datos reales
            $('#input-new-avatar').val('');
            cargarPerfil();
            cargarPinesDelUsuario();

        } catch (e) {
            alert("Error al actualizar los datos del perfil.");
        } finally {
            $btn.text('Guardar').prop('disabled', false);
        }
    });

    $('#btn-logout').on('click', function() {
        if (confirm("¿Estás seguro de que quieres cerrar sesión?")) {
            localStorage.clear();
            window.location.href = "login.html";
        }
    });

    // Arranque inicial
    cargarPerfil();
    cargarPinesDelUsuario();
});