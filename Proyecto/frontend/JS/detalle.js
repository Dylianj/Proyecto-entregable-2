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
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    const currentUserId = localStorage.getItem('vnk_user_id');

    // Si alguien entra a la página sin un ID válido, lo regresamos al inicio
    if (!postId) {
        window.location.href = "index.html";
        return;
    }

    // --- 1. CARGAR DATOS PRINCIPALES DE LA PUBLICACIÓN ---
    async function cargarDetalles() {
        try {
            const postData = await $.ajax({ url: `${API_URL}/posts/${postId}`, type: 'GET' });
            
            // Inyectamos la imagen y los textos principales
            $('#detail-image').attr('src', postData.image_url);
            $('#detail-title').text(postData.title);
            $('#detail-description').text(postData.description || '');

            // Seguridad Frontend: Mostrar botón "Borrar" SOLO si soy el dueño de la publicación
            if (currentUserId && parseInt(currentUserId) === postData.user_id) {
                $('#btn-delete-post').show();
            }

            // Autor: Cargamos su nombre real y le asignamos la redirección a su perfil específico
            try {
                const userData = await $.ajax({ url: `${API_URL}/users/${postData.user_id}`, type: 'GET' });
                $('#author-name')
                    .text(userData.display_name || userData.username)
                    .attr('onclick', `window.location.href='usuario.html?id=${postData.user_id}'`);
            } catch (e) { 
                $('#author-name').text("Usuario Desconocido"); 
            }

            // Likes: Cargar el conteo total y si yo ya le di like
            try {
                const likesData = await $.ajax({ url: `${API_URL}/posts/${postId}/likes/count?user_id=${currentUserId || 0}`, type: 'GET' });
                $('#like-count').text(likesData.total_likes);
                if (likesData.user_liked) {
                    $('#btn-like').css('background', '#ff6040').text('🤍');
                }
            } catch (e) { 
                console.warn("Error cargando los likes de la publicación"); 
            }

            // Guardados: Verificar en la Base de Datos si yo ya tengo esta foto guardada
            try {
                if (currentUserId && currentUserId !== '999') {
                    const saveStatus = await $.ajax({ url: `${API_URL}/posts/${postId}/save/status?user_id=${currentUserId}`, type: 'GET' });
                    if (saveStatus.saved) {
                        $('.save-button').text('Guardado').css('background-color', '#333');
                    } else {
                        $('.save-button').text('Guardar').css('background-color', '#ff6040');
                    }
                }
            } catch (e) { 
                console.warn("Error verificando el estado de guardado"); 
            }

            // Llamamos a las demás funciones
            cargarComentarios();

            // Sugerencias Similares: Buscamos imágenes que compartan la primera etiqueta
            if (postData.tags && postData.tags.length > 0) {
                cargarContenidoSimilar(postData.tags[0], postData.id);
            } else {
                $('#similar-grid').empty().append('<p style="color:#767676; grid-column: 1/-1; text-align: center;">No hay etiquetas asociadas para buscar contenido similar.</p>');
            }

        } catch (error) {
            console.error("Error crítico al cargar el post:", error);
            $('#detail-title').text("Publicación no encontrada");
        }
    }

    // --- 2. CARGAR GALERÍA DE CONTENIDO SIMILAR ---
    async function cargarContenidoSimilar(tagPrincipal, currentPostId) {
        try {
            const resultados = await $.ajax({ url: `${API_URL}/search/?q=${tagPrincipal}`, type: 'GET' });
            const $similarGrid = $('#similar-grid');
            $similarGrid.empty();

            // Filtramos la foto actual para que no se recomiende a sí misma
            const filtrados = resultados.filter(p => p.id !== parseInt(currentPostId));

            if (filtrados.length === 0) {
                $similarGrid.append('<p style="color:#767676; grid-column: 1/-1; text-align: center;">No se encontraron otros pines con la etiqueta #' + tagPrincipal + '</p>');
                return;
            }

            filtrados.forEach(post => {
                $similarGrid.append(`
                    <div class="pin-card" onclick="window.location.href='detalle.html?id=${post.id}'" style="cursor: pointer; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <img src="${post.image_url}" alt="${post.title}" style="width: 100%; height: 200px; object-fit: cover;">
                        <div style="padding: 10px;">
                            <h4 style="margin:0; font-size: 14px; color:#333;">${post.title}</h4>
                        </div>
                    </div>
                `);
            });
        } catch (e) { 
            console.error("Error al cargar sugerencias similares", e); 
        }
    }

    // --- 3. CARGAR COMENTARIOS (CON NOMBRE Y ENLACE AL PERFIL) ---
    async function cargarComentarios() {
        try {
            const comentarios = await $.ajax({ url: `${API_URL}/posts/${postId}/comments`, type: 'GET' });
            $('#comments-count').text(`${comentarios.length} comentarios`);
            const $lista = $('#comments-list');
            $lista.empty();
            
            if (comentarios.length === 0) {
                $lista.append('<p style="color: #767676;">Aún no hay comentarios. ¡Sé el primero en opinar!</p>');
                return;
            }

            // Usamos for...of para poder consultar a la API el nombre real de cada persona
            for (const com of comentarios) {
                let nombreAutor = `Usuario #${com.user_id}`;
                
                try {
                    const userData = await $.ajax({ url: `${API_URL}/users/${com.user_id}`, type: 'GET' });
                    nombreAutor = userData.display_name || userData.username;
                } catch (e) { 
                    console.warn("No se pudo obtener el nombre del comentarista"); 
                }

                $lista.append(`
                    <div style="background: #f9f9f9; padding: 12px 16px; border-radius: 16px;">
                        <span style="font-weight: bold; font-size: 14px; cursor: pointer; text-decoration: underline;" onclick="window.location.href='usuario.html?id=${com.user_id}'">${nombreAutor}</span>
                        <p style="margin: 5px 0 0 0; font-size: 15px; color: #333;">${com.text}</p>
                    </div>
                `);
            }
        } catch (e) { 
            console.error("Error cargando comentarios", e); 
        }
    }

    // --- 4. EVENTOS E INTERACTIVIDAD ---

    // EVENTO: Borrar publicación
    $('#btn-delete-post').on('click', async function() {
        const confirmar = confirm("¿Estás seguro de que quieres borrar esta publicación? Esta acción no se puede deshacer.");
        if (!confirmar) return;

        const $btn = $(this);
        $btn.text('Borrando...').prop('disabled', true).css('opacity', '0.7');

        try {
            await $.ajax({
                url: `${API_URL}/posts/${postId}?user_id=${currentUserId}`,
                type: 'DELETE'
            });
            
            alert("Publicación borrada con éxito.");
            window.location.href = "usuario.html"; // Regresa al perfil
            
        } catch (e) {
            alert("Hubo un error al borrar la publicación.");
            $btn.text('Borrar').prop('disabled', false).css('opacity', '1');
        }
    });

    // EVENTO: Dar o quitar Like
    $('#btn-like').on('click', async function() {
        if (!currentUserId || currentUserId === '999') {
            alert("Debes iniciar sesión para dar me gusta.");
            return;
        }
        try {
            const res = await $.ajax({ url: `${API_URL}/posts/${postId}/like?user_id=${currentUserId}`, type: 'POST' });
            let currentCount = parseInt($('#like-count').text());
            
            if (res.liked) {
                $('#like-count').text(currentCount + 1);
                $('#btn-like').css('background', '#ff6040').text('🤍');
            } else {
                $('#like-count').text(currentCount - 1);
                $('#btn-like').css('background', '#efefef').text('❤️');
            }
        } catch (e) { 
            console.error("Error al procesar el like"); 
        }
    });

    // EVENTO: Enviar comentario
    $('#btn-comment').on('click', async function() {
        if (!currentUserId || currentUserId === '999') {
            alert("Debes iniciar sesión para comentar.");
            return;
        }
        const texto = $('#comment-input').val().trim();
        if (!texto) return;

        const $btn = $(this);
        $btn.text('...'); 
        try {
            await $.ajax({
                url: `${API_URL}/posts/${postId}/comments?user_id=${currentUserId}&text=${encodeURIComponent(texto)}`,
                type: 'POST'
            });
            $('#comment-input').val(''); 
            cargarComentarios(); 
        } catch (e) { 
            alert("Error al enviar el comentario."); 
        } finally {
            $btn.text('Enviar');
        }
    });

    // EVENTO: Guardar publicación (En la Base de Datos)
    $('.save-button').on('click', async function() {
        if (!currentUserId || currentUserId === '999') {
            alert("Debes iniciar sesión para guardar pines.");
            return;
        }

        const $btn = $(this);
        const originalText = $btn.text();
        $btn.text('...'); 

        try {
            const res = await $.ajax({ url: `${API_URL}/posts/${postId}/save?user_id=${currentUserId}`, type: 'POST' });
            
            if (res.saved) {
                $btn.text('Guardado').css('background-color', '#333');
            } else {
                $btn.text('Guardar').css('background-color', '#ff6040');
            }
        } catch (e) {
            alert("Error al procesar la solicitud de guardado.");
            $btn.text(originalText);
        }
    });

    // --- INICIALIZACIÓN ---
    cargarDetalles();
});