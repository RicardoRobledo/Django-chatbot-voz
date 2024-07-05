//const base_url = 'http://127.0.0.1:8000/';
const base_url = 'https://django-chatbot-voz.onrender.com/';
const assistant_name = 'Asistente NextWave';
const welcome_message = 'Saludos, ¿Que necesitas saber el día de hoy?';
let id_mensaje = 0;
const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;
const md = window.markdownit();

const signal = new AbortController().signal;

let audio = null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();


// --------------------------------------------------
//                    functions
// --------------------------------------------------

function format_chatbot_message(id) {

  const chatbotMessage = `
  <div class='chatbot-message col-12 py-4 d-flex justify-content-center' id='${id}' style='display:none;'>
      <div class='d-flex col-8' id='chatbot-message-content'>
          <img src='/static/imgs/chatbot.jpeg' width='60' height='60' class='chatbot-img'>
          <div class='m-2'>
              <h6>${assistant_name}</h6>
              <p></p>
              <div class='container-animacion'>
                <div class='cargando'>
                  <div class='pelotas'></div>
                  <div class='pelotas'></div>
                  <div class='pelotas'></div>
                </div>
              </div>
          </div>
      </div>
  </div>`;

  return chatbotMessage;

}


function format_user_message(message) {

  const userMessage = `
  <div class='user-message col-12 py-4 d-flex justify-content-center'>
      <div class='d-flex col-8' id='user-message-content'>
          <img src='/static/imgs/admin.png' width='60' height='60' class='user-img'>
          <div class='m-2'>
              <h6>Tú</h6>
              <p>${message}</p>
          </div>
      </div>
  </div>`;

  return userMessage;

}


function setUpSpeechRecognition() {

  // Configuración de Speech Recognition
  recognition.lang = 'es-ES'; // Configurar el idioma
  recognition.interimResults = false; // Mostrar resultados intermedios
  recognition.maxAlternatives = 1; // Número máximo de resultados alternativos
  recognition.continuous = true;

  // Eventos de reconocimiento
  recognition.onstart = () => {
    $('#btn-play-speaker').hide();
  };

  recognition.onresult = async (event) => {

    recognition.stop();
    let userMessage = event.results[0][0].transcript;

    // getting identifier to add in chatbot message
    const id = 'container-chatbot-message-' + id_mensaje++;
    const formattedChatbotMessage = format_chatbot_message(id);
    const formattedUserMessage = format_user_message(userMessage);

    // adding messages to conversation
    $('.conversation').append(formattedUserMessage);
    $('.conversation').append(formattedChatbotMessage);

    $('.container-animacion').remove();
    $(`#${id}`).fadeIn();

    // sending message to chatbot
    const url = base_url + 'chatbot/message/voice/';
    const response = await send_message(url, id, userMessage, signal);

  };

  recognition.onspeechend = () => {

  };

  recognition.onerror = (event) => {
    recognition.stop();

    if (event.error === 'no-speech') {
      $('#btn-play-speaker').show();
      $('#btn-stop-speaker').hide();
    }
  };

}


function reproduceSpeaker(voiceResponse) {

  $('#btn-stop-speaker').show();
  $('.chatbot-img-container').css({'border':'8px solid rgb(24, 177, 70)', 'border-radius':'50%'});

  const audioBinario = atob(voiceResponse);

  const arrayBuffer = new ArrayBuffer(audioBinario.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < audioBinario.length; i++) {
    uint8Array[i] = audioBinario.charCodeAt(i);
  }

  const blob = new Blob([uint8Array], { type: 'audio/wav' });
  const audioUrl = URL.createObjectURL(blob);
  audio = new Audio(audioUrl);
  audio.play();

  audio.onended = function() {
    $('#btn-play-speaker').show();
    $('#btn-stop-speaker').hide();
    $('.chatbot-img-container').css({'border':'', 'border-radius':''});
  };

}


function playSpeaker() {

  recognition.start();

}


function cancelSpeaker() {

  $('.chatbot-speaker').remove();
  $('#initial-cards-container').hide();
  $('section').show();
  recognition.stop();
  window.scrollTo(0, document.documentElement.scrollHeight);

  stopAudio();
  
};


function stopSpeaker() {

  $('#btn-play-speaker').show();
  $('#btn-stop-speaker').hide();
  $('.chatbot-img-container').css({'border':'', 'border-radius':''});
  
  stopAudio();

};


function stopAudio(){

  if (audio) {
    audio.pause();
    audio = null;
  }

}


function hide_message_container() {
  $('#btn-enviar').hide();
  $('#input-message').hide();
}


function disable_form_message() {
  $('#btn-detener').show();
  $('#btn-enviar').hide();
  $('#input-message').prop('disabled', true);
}


function enable_form_message() {
  let send_button = $('#btn-enviar');
  send_button.css('color', '#000000');
  send_button.css('background-color', '#c5c5c5');
  send_button.prop('disabled', true);
  send_button.show();
  $('#btn-detener').hide();
  $('#input-message').prop('disabled', false);
}


async function initialize() {

  let send_button = $('#btn-enviar');
  send_button.css('background-color', '#c5c5c5');
  send_button.css('color', '#000000');
  send_button.prop('disabled', true);
  $('#btn-detener').hide();
  $('.chatbot-speaker').hide();
  setUpSpeechRecognition();
  create_conversation_thread();

}


function get_message() {
  const message = $('#input-message').val();
  $('#input-message').val('');
  return message;
}


async function send_message(url, id, user_message, signal) {

  const thread_id = localStorage.getItem('thread_id');

  const response = await fetch(url, {
    signal: signal,
    method: 'POST',
    mode: 'same-origin',
    headers: {
      'X-CSRFToken': csrftoken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ thread_id, user_message })
  }).then(async (response) => {

    if (response.status === 402) {
      throw new PaymentRequiredError('Error, se ha alcanzado alcanzado el límite de saldo');
    } else {
      return response.json();
    }

  }).then(
    async (data) => {

      const msg = data['msg'];
      let resultHtml = '';

      const parser = new DOMParser();
      const doc = parser.parseFromString(msg, 'text/html');

      if ('voice_response' in data) {

        voiceResponse = data['voice_response']
        reproduceSpeaker(voiceResponse);

        resultHtml = md.render(msg);
        $(`#${id} .m-2 p`).append(resultHtml);

      } else if ('img' in data) {

        resultHtml = md.render(msg);
        $(`#${id} .m-2`).append(resultHtml);
        $(`#${id} .m-2`).append(`<img src="data:image/png;base64,${data['img']}" class="img-fluid">`);

      } else if (Array.from(doc.body.childNodes).some(node => node.nodeType === 1)) {

        const table = `
        <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      <p class="fw-semibold">Tabla generada</p>
    </div>
    <div class="card-body">
      <div class="container">
        <div class="table-responsive">
          ${doc.body.innerHTML}
        </div>
      </div>
    </div>
  </div>`;

        $(`#${id} .m-2 p`).html(table);
        $('table').addClass('table table-warning table-bordered table-hover');
        $(`#${id} #chatbot-message-content`).addClass('flex-column');

      } else {

        resultHtml = md.render(msg);
        $(`#${id} .m-2 p`).append(resultHtml);

      }

    }
  ).catch(error => {

    if (error.name === 'AbortError') {
      $(`#${id} .m-2 p`).append('<h7 class="text-secondary">Mensaje detenido<h7>');
    } else if (error.name === 'PaymentRequiredError') {
      $(`#${id} .m-2 p`).append('<h7 class="text-danger">Error, el límite de cuota ha sido alcanzado, por favor verifique su crédito<h7>');
    } else {
      $(`#${id} .m-2 p`).append('<h7 class="text-danger">Hubo un error en el mensaje<h7>');
    }

  });

  return response;
}


async function create_conversation_thread() {

  const response = await fetch(base_url + 'chatbot/thread_id/', {

    method: 'POST',
    mode: 'same-origin',
    headers: {
      'X-CSRFToken': csrftoken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})

  }).then(async (response) => {

    if (response.status === 200) {
      return response.json();
    }

  }).then(async (data) => {

    $('#btn-enviar').fadeIn(900)
    $('#input-message').show(900);
    $('#form-calendar').hide();
    $('#message-container form').remove();
    $('#success-badge').fadeIn(900);
    $('#initial-cards-container').fadeIn(900);

    return data;

  });

  localStorage.setItem('thread_id', response['thread_id']);

}


async function delete_conversation_thread() {

  if (localStorage.getItem('thread_id') !== null) {

    var requestOptions = {
      method: 'POST',
      mode: 'same-origin',
      headers: {
        'X-CSRFToken': csrftoken,
        'Content-Type': 'application/json',
      }
    };

    const thread_url = base_url + 'chatbot/thread_id/' + localStorage.getItem('thread_id') + '/'
    navigator.sendBeacon(thread_url, requestOptions);

    localStorage.removeItem('thread_id');

  }

}


// --------------------------------------------------
//                      events
// --------------------------------------------------


$('.initial-message-container').on('click', function () {
  const text = $(this).find('.card-text').text();
  $('#initial-cards-container').hide();
  enable_form_message();
  $('#input-message').val(text);
  $('#btn-enviar').click();
  disable_form_message();
});


$('#input-message').on('keyup', function (event) {

  let text = $(this).val();
  let button = $('#btn-enviar');

  if (text.trim() === "") {
    button.css('color', '#000000');
    button.css('background-color', '#c5c5c5');
    button.prop('disabled', true);
  } else {
    if (event.keyCode === 13) {
      button.trigger('click');
    }

    button.css('color', '#ffffff');
    button.css('background-color', '#007bff');
    button.prop('disabled', false);
  }

});


$('#confirm-button').click(async function (event) {

  event.preventDefault();

  function isValidDate(date) {
    return date instanceof Date && !isNaN(date);
  }

  const fromDate = new Date($('#datepicker').val());
  const toDate = new Date($('#datepicker2').val());

  if (!isValidDate(fromDate) || !isValidDate(toDate)) {

    $('#warning-badge').text('Una o ambas fechas son inválidas');
    $('#warning-badge').fadeIn(900, function () {
      $(this).delay(2000).fadeOut(900);
    });

  } else if (fromDate > toDate) {

    $('#warning-badge').text('La fecha inicial no puede ser mayor a la fecha final');
    $('#warning-badge').fadeIn(900, function () {
      $(this).delay(2000).fadeOut(900);
    });

  } else {

    await create_conversation_thread(fromDate, toDate);

  }

});


$('#btn-logout').click(async function (event) {

  await delete_conversation_thread();
  window.location.href = '/authentication/login/';

});


$('#btn-enviar').on('click', async function () {

  $('#initial-cards-container').hide();
  disable_form_message();
  const userMessage = get_message();

  // getting identifier to add in chatbot message
  const id = 'container-chatbot-message-' + id_mensaje++;
  const formattedChatbotMessage = format_chatbot_message(id);
  const formattedUserMessage = format_user_message(userMessage);

  // adding messages to conversation
  $('.conversation').append(formattedUserMessage);
  $('.conversation').append(formattedChatbotMessage);

  window.scrollTo(0, document.documentElement.scrollHeight);

  // sending message to chatbot
  const message_url = base_url + 'chatbot/message/';
  const response = await send_message(message_url, id, userMessage, signal);

  $('.container-animacion').remove();
  $(`#${id}`).fadeIn();

  window.scrollTo(0, document.documentElement.scrollHeight);

  enable_form_message();

});


$('#btn-detener').on('click', function () {
  enable_form_message();
  if (controller) {
    controller.abort(); // Se llama al método abort() del controlador para cancelar la petición
    console.log('Petición cancelada');
  }
});


$('#btn-microphone').on('click', function () {

  $('section').hide();
  $('#contenido').append(`
    <div class='chatbot-speaker d-flex flex-column justify-content-center align-items-center mt-5'>
      <div class='chatbot-img-container'>
        <img src='/static/imgs/chatbot.jpeg' class='chatbot-img' width='250px' height='250px'>
      </div>
      <div class='m-5' id='message-container'>
        <h4 class='fw-bold'>${assistant_name}</h4>
      </div>
      <div class='mx-5'>
        <button class='mx-2' id='btn-stop-speaker' onclick='stopSpeaker()'>
          <img src='/static/imgs/stop.png' width='80px' height='80px'>
        </button>
        <button class='mx-2' id='btn-play-speaker' onclick='playSpeaker()'>
          <img src='/static/imgs/play.png' width='80px' height='80px'>
        </button>
        <button class='mx-2' id='btn-cancel-speaker' onclick='cancelSpeaker()'>
          <img src='/static/imgs/cancel.png' width='80px' height='80px'>
        </button>
      </div>
    </div>`);
  $('.chatbot-speaker').addClass('chatbot-speaker-visible');
  $('#btn-stop-speaker').hide();
  $('#btn-play-speaker').hide();
  $('.chatbot-speaker').show();

  recognition.start();

});


$(window).on('beforeunload', async function () {

  if (localStorage.getItem('thread_id') !== null) {
    await delete_conversation_thread();
  }

});


// --------------------------------------------------
//                 custom exceptions
// --------------------------------------------------


class CustomError extends Error {
  constructor(name, message) {
    super(message);
    this.name = name;
  }
}

// Otra clase de error personalizada
class PaymentRequiredError extends CustomError {
  constructor(message) {
    super('PaymentRequiredError', message);
  }
}

// --------------------------------------------------
//                 initialization
// --------------------------------------------------


$(document).ready(async function () {

  await initialize();

  $("#message-container h6").text(`{{assistant_name}}`.replace("{{assistant_name}}", assistant_name));
  $("#message-container p").text(`{{welcome_message}}`.replace("{{welcome_message}}", welcome_message));

  $(".loader-wrapper").fadeOut(1200, function () {
    $("#contenido").fadeIn(1500);
  });

});

//$( document ).ready(function(){});
//$( window ).on( "load", function(){});