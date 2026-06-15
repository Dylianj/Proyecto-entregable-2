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
    const userId = localStorage.getItem('vnk_user_id');
    
    // --- MODO EXPLORADOR VS USUARIO ---
    if (!userId || userId === '999') {
        const botonLogin = `
            <a href="login.html" style="background-color: #ff6040; color: white; padding: 10px 20px; border-radius: 24px; text-decoration: none; font-weight: bold; font-size: 15px; white-space: nowrap;">
                Iniciar Sesión
            </a>
        `;
        $('#header-profile-img').replaceWith(botonLogin);
        
        $('.sidebar-img.icon').not('.active').on('click', function(e) {
            e.preventDefault();
            window.location.href = "login.html";
        });
    } else {
        const profilePic = localStorage.getItem('vnk_profile_pic');
        if (profilePic) {
            $('#header-profile-img').attr('src', profilePic);
        }
    }

    // Inicializamos la página
    cargarFeed(`${API_URL}/posts/`);
    cargarCategoriasDinamicas();

    // --- BÚSQUEDA EN VIVO ---
    $('.search-bar input').on('input', function() {
        const query = $(this).val().trim();
        if (query.length > 0) {
            cargarFeed(`${API_URL}/search/?q=${encodeURIComponent(query)}`);
        } else {
            cargarFeed(`${API_URL}/posts/`);
        }
    });

    // --- FUNCIÓN: CARGAR FEED ---
    async function cargarFeed(url) {
        try {
            const posts = await $.ajax({ url: url, type: 'GET' });
            const $grid = $('.pin-container'); 
            $grid.empty();

            if (posts.length === 0) {
                $grid.append('<p style="grid-column: 1/-1; text-align: center; color: #767676; margin-top: 40px;">No se encontraron publicaciones.</p>');
                return;
            }

            posts.forEach(post => {
                $grid.append(`
                    <div class="pin-card" onclick="window.location.href='detalle.html?id=${post.id}'" style="cursor: pointer;">
                        <img src="${post.image_url}" alt="${post.title}">
                        <div class="pin-card-info" style="padding: 8px;">
                            <h3 style="font-size: 14px; margin: 0; color: #333;">${post.title}</h3>
                        </div>
                    </div>
                `);
            });
        } catch (e) { console.error("Error al cargar el feed", e); }
    }

    // --- FUNCIÓN: CATEGORÍAS (HASHTAGS POPULARES) ---
    async function cargarCategoriasDinamicas() {
        try {
            const tagsPopulares = await $.ajax({ url: `${API_URL}/tags/popular`, type: 'GET' });
            const $navBar = $('.categories-bar'); 
            
            if ($navBar.length === 0) return; 
            
            $navBar.empty();
            $navBar.append(`<button class="cat-btn active" data-tag="todos" style="background: #333; color: white; border: none; padding: 10px 18px; border-radius: 24px; font-weight: bold; cursor: pointer; margin-right: 10px;">Todos</button>`);

            tagsPopulares.forEach(tag => {
                $navBar.append(`
                    <button class="cat-btn" data-tag="${tag.name}" style="background: #efefef; color: #333; border: none; padding: 10px 18px; border-radius: 24px; font-weight: bold; cursor: pointer; margin-right: 10px; transition: 0.2s;">
                        #${tag.name}
                    </button>
                `);
            });

            // Evento click en los botones generados
            $('.cat-btn').on('click', function() {
                $('.cat-btn').css({ 'background': '#efefef', 'color': '#333' });
                $(this).css({ 'background': '#333', 'color': 'white' });

                const seleccion = $(this).data('tag');
                if (seleccion === 'todos') {
                    cargarFeed(`${API_URL}/posts/`);
                } else {
                    cargarFeed(`${API_URL}/search/?q=${seleccion}`);
                }
            });
        } catch (e) { console.warn("No se pudieron cargar las categorías dinámicas"); }
    }
});