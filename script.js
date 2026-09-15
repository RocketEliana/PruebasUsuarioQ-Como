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
const STORAGE_KEY = 'qcomo_sus_responses';

const questionsEl = document.getElementById('questions');
STATEMENTS.forEach((text, i) => {
  const div = document.createElement('div');
  div.className = 'q';
  const scaleHtml = [1,2,3,4,5].map(v =>
    `<input type="radio" name="q${i}" id="q${i}_${v}" value="${v}" required>
     <label for="q${i}_${v}">${v}</label>`
  ).join('');
  div.innerHTML = `
    <p>${i+1}. ${text}</p>
    <div class="scale">${scaleHtml}</div>
    <div class="scale-legend"><span>Muy en desacuerdo</span><span>Muy de acuerdo</span></div>
  `;
  questionsEl.appendChild(div);
});

function computeSUS(values){
  let total = 0;
  ODD.forEach(i => total += (values[i] - 1));
  EVEN.forEach(i => total += (5 - values[i]));
  return total * 2.5;
}

function loadResponses(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

function saveResponses(list){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  }catch(e){ return false; }
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
  document.getElementById('avgScore').textContent = avg.toFixed(1);
  document.getElementById('countText').textContent = list.length + (list.length===1 ? ' respuesta' : ' respuestas');
  statsCard.style.display = 'block';

  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = '';
  list.slice().reverse().forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.name || '—'}</td><td>${item.score.toFixed(1)}</td><td>${item.date}</td>`;
    tbody.appendChild(tr);
  });
  historyCard.style.display = 'block';
}

function showMsg(text, ok){
  const el = document.getElementById('resultMsg');
  el.innerHTML = `<div class="msg ${ok?'ok':'err'}">${text}</div>`;
  setTimeout(()=>{ el.innerHTML=''; }, 4000);
}

let currentList = loadResponses();
renderStats(currentList);

document.getElementById('susForm').addEventListener('submit', function(e){
  e.preventDefault();

  const values = [];
  for(let i=0;i<10;i++){
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    values.push(parseInt(checked.value, 10));
  }
  const score = computeSUS(values);
  const name = document.getElementById('pname').value.trim();
  const comments = document.getElementById('comments').value.trim();

  const entry = {
    name: name,
    score: score,
    comments: comments,
    date: new Date().toLocaleDateString('es-ES')
  };

  currentList.push(entry);
  const ok = saveResponses(currentList);

  if(ok){
    showMsg(`Guardado. Puntuación SUS de esta respuesta: <b>${score.toFixed(1)}</b> / 100`, true);
    renderStats(currentList);
    this.reset();
  }else{
    currentList.pop();
    showMsg('No se pudo guardar en este navegador.', false);
  }
});

document.getElementById('clearBtn').addEventListener('click', function(){
  if(!confirm('¿Borrar todas las respuestas guardadas en este navegador?')) return;
  localStorage.removeItem(STORAGE_KEY);
  currentList = [];
  renderStats(currentList);
  showMsg('Historial borrado.', true);
});

document.getElementById('exportBtn').addEventListener('click', function(){
  if(currentList.length === 0) return;
  let csv = 'Participante,Puntuacion SUS,Fecha,Comentarios\n';
  currentList.forEach(item => {
    const comment = (item.comments || '').replace(/"/g, '""');
    csv += `"${item.name || ''}",${item.score.toFixed(1)},"${item.date}","${comment}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qcomo-sus-respuestas.csv';
  a.click();
  URL.revokeObjectURL(url);
});
