const STATEMENTS = [
  "Creo que usaría Q-Como con frecuencia",
  "Me ha parecido innecesariamente complicada",
  "Me ha parecido fácil de usar",
  "Creo que necesitaría ayuda de alguien técnico para usarla",
  "Las funciones están bien integradas entre sí",
  "Hay demasiada inconsistencia en la app",
  "Creo que la mayoría aprendería a usarla rápido",
  "Me ha resultado incómoda o torpe de usar",
  "Me he sentido seguro/a usándola",
  "He necesitado aprender muchas cosas antes de poder usarla"
];
const ODD = [0,2,4,6,8];
const EVEN = [1,3,5,7,9];

// Preguntas específicas de Q-Como (todas en positivo: 5 = mejor)
const CUSTOM_STATEMENTS = [
  "El escaneo del código de barras funcionó como esperaba",
  "La información del producto (Nutriscore/Ecoscore) fue fácil de entender",
  "Encontrar y guardar productos en favoritos fue sencillo",
  "Entendí para qué sirven los puntos y las recompensas",
  "La mascota (Bob) y sus animaciones hicieron la experiencia más agradable",
  "El diseño visual (colores, iconos, textos) me pareció atractivo",
  "Confié en la información mostrada sobre los productos",
  "Volvería a usar Q-Como para consultar productos en el supermercado"
];

const STORAGE_KEY = 'qcomo_sus_responses';

// Copia en memoria de la sesión actual. Se usa siempre, incluso si
// localStorage falla, para que "Exportar a CSV" nunca se quede sin datos.
let currentList = [];
let storageAvailable = true;

function renderQuestionSet(container, statements, namePrefix){
  statements.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'q';
    const scaleHtml = [1,2,3,4,5].map(v =>
      `<input type="radio" name="${namePrefix}${i}" id="${namePrefix}${i}_${v}" value="${v}" required>
       <label for="${namePrefix}${i}_${v}">${v}</label>`
    ).join('');
    div.innerHTML = `
      <p>${i+1}. ${text}</p>
      <div class="scale">${scaleHtml}</div>
      <div class="scale-legend"><span>Muy en desacuerdo</span><span>Muy de acuerdo</span></div>
    `;
    container.appendChild(div);
  });
}

renderQuestionSet(document.getElementById('questions'), STATEMENTS, 'q');
renderQuestionSet(document.getElementById('customQuestions'), CUSTOM_STATEMENTS, 'c');

function computeSUS(values){
  let total = 0;
  ODD.forEach(i => total += (values[i] - 1));
  EVEN.forEach(i => total += (5 - values[i]));
  return total * 2.5;
}

function computeCustomAvg(values){
  const sum = values.reduce((a,b) => a+b, 0);
  return sum / values.length;
}

// Lee todo lo que ya hubiera guardado en este navegador (si lo hay)
// y lo combina con lo que llevamos en memoria en esta sesión.
function loadResponses(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('No se pudo leer localStorage:', e);
    storageAvailable = false;
    return [];
  }
}

// Intenta persistir. Si falla, NO se pierde nada: currentList (en memoria)
// se mantiene intacta y el CSV se sigue pudiendo exportar con lo recogido
// en esta sesión, aunque no sobreviva a recargar la página.
function saveResponses(list){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    storageAvailable = true;
    return true;
  }catch(e){
    console.error('No se pudo guardar en localStorage:', e);
    storageAvailable = false;
    return false;
  }
}

function renderStats(list){
  const statsCard = document.getElementById('statsCard');
  const historyCard = document.getElementById('historyCard');
  if(list.length === 0){
    statsCard.style.display = 'none';
    historyCard.style.display = 'none';
    return;
  }
  const avg = list.reduce((a,b)=>a+b.score,0) / list.length;
  const avgCustom = list.reduce((a,b)=>a+(b.customScore||0),0) / list.length;
  document.getElementById('avgScore').textContent = avg.toFixed(1);
  document.getElementById('avgCustom').textContent = avgCustom.toFixed(2);
  document.getElementById('countText').textContent = list.length + (list.length===1 ? ' respuesta' : ' respuestas');
  statsCard.style.display = 'block';

  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = '';
  list.slice().reverse().forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.name || '—'}</td><td>${item.score.toFixed(1)}</td><td>${(item.customScore||0).toFixed(2)}</td><td>${item.date}</td>`;
    tbody.appendChild(tr);
  });
  historyCard.style.display = 'block';
}

function showMsg(text, ok){
  const el = document.getElementById('resultMsg');
  el.innerHTML = `<div class="msg ${ok?'ok':'err'}">${text}</div>`;
  setTimeout(()=>{ el.innerHTML=''; }, 5000);
}

currentList = loadResponses();
renderStats(currentList);

// Lee las respuestas de un bloque de preguntas. Devuelve null (en vez de
// lanzar un error) si falta alguna respuesta, para poder avisar con un
// mensaje claro en vez de que el formulario falle en silencio.
function readAnswers(namePrefix, count){
  const values = [];
  for(let i=0;i<count;i++){
    const checked = document.querySelector(`input[name="${namePrefix}${i}"]:checked`);
    if(!checked) return null;
    values.push(parseInt(checked.value, 10));
  }
  return values;
}

document.getElementById('susForm').addEventListener('submit', function(e){
  e.preventDefault();

  try{
    const susValues = readAnswers('q', STATEMENTS.length);
    if(!susValues){
      showMsg('Falta responder alguna pregunta del cuestionario SUS. Revisa que estén todas marcadas.', false);
      return;
    }
    const customValues = readAnswers('c', CUSTOM_STATEMENTS.length);
    if(!customValues){
      showMsg('Falta responder alguna pregunta específica de Q-Como. Revisa que estén todas marcadas.', false);
      return;
    }

    const score = computeSUS(susValues);
    const customScore = computeCustomAvg(customValues);
    const name = document.getElementById('pname').value.trim();
    const comments = document.getElementById('comments').value.trim();

    const entry = {
      name: name,
      score: score,
      customScore: customScore,
      comments: comments,
      date: new Date().toLocaleDateString('es-ES')
    };

    // Se añade siempre a la copia en memoria primero, así el CSV nunca
    // pierde una respuesta aunque falle el guardado persistente.
    currentList.push(entry);
    const persisted = saveResponses(currentList);

    if(persisted){
      showMsg(`Guardado. SUS: <b>${score.toFixed(1)}</b>/100 · Q-Como: <b>${customScore.toFixed(2)}</b>/5`, true);
    }else{
      showMsg(`Respuesta registrada en esta sesión (SUS: <b>${score.toFixed(1)}</b>, Q-Como: <b>${customScore.toFixed(2)}</b>), pero este navegador no permite guardar de forma permanente. Exporta el CSV antes de cerrar la pestaña para no perderla.`, false);
    }
    renderStats(currentList);
    this.reset();
  }catch(err){
    console.error('Error al procesar el formulario:', err);
    showMsg('Ha ocurrido un error inesperado al guardar. Revisa la consola del navegador para más detalles.', false);
  }
});

document.getElementById('clearBtn').addEventListener('click', function(){
  if(!confirm('¿Borrar todas las respuestas guardadas en este navegador?')) return;
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){ console.error(e); }
  currentList = [];
  renderStats(currentList);
  showMsg('Historial borrado.', true);
});

document.getElementById('exportBtn').addEventListener('click', function(){
  if(currentList.length === 0){
    showMsg('Todavía no hay ninguna respuesta guardada en esta sesión.', false);
    return;
  }
  let csv = 'Participante,Puntuacion SUS,Puntuacion Q-Como,Fecha,Comentarios\n';
  currentList.forEach(item => {
    const comment = (item.comments || '').replace(/"/g, '""');
    csv += `"${item.name || ''}",${item.score.toFixed(1)},${(item.customScore||0).toFixed(2)},"${item.date}","${comment}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qcomo-sus-respuestas.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
