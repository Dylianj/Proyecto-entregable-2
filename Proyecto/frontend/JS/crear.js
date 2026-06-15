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
    if (!userId || userId === '999') {
        alert("Debes iniciar sesión con una cuenta real para subir imágenes.");
        window.location.href = "login.html";
        return;
    }

    const profilePic = localStorage.getItem('vnk_profile_pic');
    if (profilePic) {
        $('#header-profile-img').attr('src', profilePic);
    }

    // --- CARGAR SUGERENCIAS DE ETIQUETAS ---
    async function cargarSugerenciasTags() {
        try {
            const tags = await $.ajax({ url: `${API_URL}/tags/popular`, type: 'GET' });
            const $datalist = $('#tags-sugeridos');
            tags.forEach(t => {
                $datalist.append(`<option value="${t.name}">`);
            });
        } catch (e) { console.log("Error al traer sugerencias de etiquetas"); }
    }
    cargarSugerenciasTags();

    // --- VISTA PREVIA (Con corrección de rebote) ---
    $('#uploadArea').on('click', function() {
        $('#imageInput')[0].click(); 
    });

    $('#imageInput').on('click', function(event) {
        event.stopPropagation(); 
    });

    $('#imageInput').on('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#imagePreview').attr('src', e.target.result).show();
                $('#uploadText').hide();
            }
            reader.readAsDataURL(file);
        }
    });

    // --- ENVIAR DATOS A S3 Y BDD ---
    $('#createPostForm').on('submit', async function(event) {
        event.preventDefault();
        const $btn = $('#submitBtn');
        $btn.text('Subiendo...').prop('disabled', true).css('opacity', '0.7');

        const formData = new FormData();
        formData.append('user_id', userId);
        formData.append('title', $('#postTitle').val());
        formData.append('description', $('#postDescription').val() || "");
        formData.append('tags_string', $('#postTags').val() || ""); 
        formData.append('file', $('#imageInput')[0].files[0]);

        try {
            await $.ajax({
                url: `${API_URL}/posts/`,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
            });
            alert("¡Publicación creada con éxito!");
            window.location.href = "index.html";
        } catch (error) {
            alert("Hubo un error al guardar la publicación.");
            $btn.text('Guardar').prop('disabled', false).css('opacity', '1');
        }
    });
});