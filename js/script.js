let obrig = [];
let cursadas = JSON.parse(localStorage.getItem('cursadas_ufmt')) || [];
let plano = JSON.parse(localStorage.getItem('plano_ufmt')) || {};
let semestreAtivo = "";

const REGRAS_OFERTA = {
    "2026/1": { "20261": [1, 9, 10], "20251": [2, 4, 6, 8, 9, 10] },
    "2026/2": { "20261": [2, 9, 10], "20251": [3, 5, 7, 9, 10] },
    "2027/1": { "20261": [1, 3, 9, 10], "20251": [4, 6, 8, 9, 10] },
    "2027/2": { "20261": [2, 4, 9, 10], "20251": [5, 7, 9, 10] },
    "2028/1": { "20261": [1, 3, 5, 9, 10], "20251": [6, 8, 9, 10] },
    "2028/2": { "20261": [2, 4, 6, 9, 10], "20251": [7, 9, 10] },
    "2029/1": { "20261": [1, 3, 5, 7, 9, 10], "20251": [8, 9, 10] },
    "2029/2": { "20261": [2, 4, 6, 8, 9, 10], "20251": [] }
};

async function carregar() {
    try {
        const res = await fetch('./data/disciplinas_obrigatorias.json');
        if (!res.ok) throw new Error("Erro ao carregar JSON");
        obrig = await res.json();
        const sems = Object.keys(plano);
        if (sems.length > 0) semestreAtivo = sems[sems.length - 1];
        renderizarTudo();
    } catch (e) { console.error(e); alert("Erro ao carregar dados."); }
}

function calcularProximoSemestre(ultimo) {
    let [ano, periodo] = ultimo.split('/').map(Number);
    if (periodo === 1) return `${ano}/2`;
    return `${ano + 1}/1`;
}

function renderizarTudo() {
    const ppc = document.getElementById('filtroPPC').value;
    const ppcKey = `ppc_${ppc}`;

    // Mapa reverso do plano para identificar planejadas no histórico
    const mapaPlano = {};
    Object.entries(plano).forEach(([semestre, codigos]) => {
        codigos.forEach(c => mapaPlano[c] = semestre);
    });

    const boxHistorico = document.getElementById('checklistObrigatorias');
    boxHistorico.innerHTML = '';
    const semestres = {};
    obrig.forEach(d => {
        const s = d[ppcKey];
        if (s) {
            if (!semestres[s]) semestres[s] = [];
            semestres[s].push(d);
        }
    });

    Object.keys(semestres).sort((a,b) => a-b).forEach(s => {
        const coluna = document.createElement('div');
        coluna.className = 'coluna-semestre';
        coluna.innerHTML = `<h4>${s}º Semestre</h4>`;
        const lista = document.createElement('div');
        lista.className = 'lista-disciplinas-vertical';

        semestres[s].forEach(d => {
            const isChecked = cursadas.includes(d.codigo);
            const planejadoPara = mapaPlano[d.codigo];

            const nomesPre = (d.prerequisitos || []).map(cod => {
                const disc = obrig.find(o => o.codigo === cod);
                return disc ? disc.nome : cod;
            }).join(', ');

            const item = document.createElement('div');
            item.className = `item-check ${isChecked ? 'active' : ''} ${planejadoPara ? 'is-planned' : ''}`;
            item.innerHTML = `
                <input type="checkbox" id="c-${d.codigo}" ${isChecked ? 'checked' : ''} onchange="toggle('${d.codigo}')">
                <label for="c-${d.codigo}">
                    <strong>${d.codigo}</strong>
                    <small>${d.nome}</small>
                    ${planejadoPara ? `<div class="badge-plano-pdf">Planejada: ${planejadoPara}</div>` : ''}
                    ${nomesPre ? `<div class="info-pre-historico">Req: ${nomesPre}</div>` : ''}
                </label>
            `;
            lista.appendChild(item);
        });
        coluna.appendChild(lista);
        boxHistorico.appendChild(coluna);
    });

    renderizarPendencias(ppcKey);
    renderizarGrade();

    localStorage.setItem('cursadas_ufmt', JSON.stringify(cursadas));
    localStorage.setItem('plano_ufmt', JSON.stringify(plano));
}

function renderizarPendencias(ppcKey) {
    const box = document.getElementById('listaDisponiveis');
    box.innerHTML = '';
    if (!semestreAtivo) {
        box.innerHTML = '<p style="padding:10px; font-size:0.8rem; color:red">Selecione um semestre no Passo 3.</p>';
        return;
    }

    const jaPlanejadas = Object.values(plano).flat();
    const ofertaDesteSemestre = REGRAS_OFERTA[semestreAtivo];

    const pendentes = obrig.filter(d => {
        const jaCursada = cursadas.includes(d.codigo);
        const jaNoPlano = jaPlanejadas.includes(d.codigo);
        let estaOfertada = false;
        if (ofertaDesteSemestre) {
            if (d.ppc_20261 && ofertaDesteSemestre["20261"].includes(d.ppc_20261)) estaOfertada = true;
            if (d.ppc_20251 && ofertaDesteSemestre["20251"].includes(d.ppc_20251)) estaOfertada = true;
        } else { estaOfertada = !!d[ppcKey]; }
        return estaOfertada && !jaCursada && !jaNoPlano;
    });

    pendentes.forEach(d => {
        const preReqCodes = d.prerequisitos || [];
        const nomesPreReqs = preReqCodes.map(cod => {
            const disc = obrig.find(o => o.codigo === cod);
            return disc ? disc.nome : cod;
        });
        const cumprePreReq = preReqCodes.every(p => cursadas.includes(p));

        const div = document.createElement('div');
        div.className = `mini-card ${!cumprePreReq ? 'alerta-pre' : ''}`;
        div.innerHTML = `
            <div class="info-pendente">
                <strong>${d.codigo}</strong><small>${d.nome}</small>
                <div class="tag-pre">${nomesPreReqs.length ? 'Req: ' + nomesPreReqs.join(', ') : 'Sem pré-requisito'}</div>
            </div>
            <button onclick="addAoPlano('${d.codigo}')">Add</button>
        `;
        box.appendChild(div);
    });
}

function renderizarGrade() {
    const container = document.getElementById('gradeSemestres');
    container.innerHTML = '';
    Object.entries(plano).forEach(([sem, codigos]) => {
        let totalCreditos = 0;
        const estaAtivo = sem === semestreAtivo;
        const coluna = document.createElement('div');
        coluna.className = `coluna-semestre ${estaAtivo ? 'semestre-selecionado' : ''}`;
        coluna.onclick = () => { semestreAtivo = sem; renderizarTudo(); };
        const lista = document.createElement('div');
        lista.className = 'lista-disciplinas-vertical';
        codigos.forEach(cod => {
            const d = obrig.find(x => x.codigo === cod);
            if (d) {
                const creditos = (parseInt(d.carga_horaria) || 0) / 16;
                totalCreditos += creditos;
                const item = document.createElement('div');
                item.className = 'card-disciplina';
                item.innerHTML = `
                    <label><strong>${cod}</strong><br><small>${d.nome} (${creditos} cr)</small></label>
                    <b onclick="event.stopPropagation(); removerDoPlano('${sem}','${cod}')" style="color:red; cursor:pointer">×</b>
                `;
                lista.appendChild(item);
            }
        });
        const excesso = totalCreditos > 36 ? 'excesso-creditos' : '';
        coluna.innerHTML = `<h4>${estaAtivo ? '📌 ' : ''}${sem} <span class="badge-creditos ${excesso}">${totalCreditos} CR</span> <span onclick="event.stopPropagation(); removerSemestre('${sem}')">🗑</span></h4>`;
        coluna.appendChild(lista);
        container.appendChild(coluna);
    });
}

function toggle(cod) {
    if (cursadas.includes(cod)) cursadas = cursadas.filter(c => c !== cod);
    else {
        cursadas.push(cod);
        Object.keys(plano).forEach(s => plano[s] = plano[s].filter(c => c !== cod));
    }
    renderizarTudo();
}

function addSemestre() {
    let novo = "";
    const sems = Object.keys(plano).sort();
    if (!sems.length) novo = prompt("Início (Ex: 2026/1)");
    else novo = calcularProximoSemestre(sems[sems.length - 1]);
    if (novo && !plano[novo]) { plano[novo] = []; semestreAtivo = novo; renderizarTudo(); }
}

function addAoPlano(cod) {
    if (!semestreAtivo) return;
    if (!plano[semestreAtivo].includes(cod)) { plano[semestreAtivo].push(cod); renderizarTudo(); }
}

function removerDoPlano(s, c) { plano[s] = plano[s].filter(x => x !== c); renderizarTudo(); }
function removerSemestre(s) { if(confirm(`Remover ${s}?`)) { delete plano[s]; semestreAtivo = ""; renderizarTudo(); } }
function limparDados() { if(confirm("Limpar tudo?")) { localStorage.clear(); location.reload(); } }
function gerarPDF() { window.print(); }
function exportarExcel() {
    let csv = "Semestre;Codigo;Disciplina\n";
    Object.entries(plano).forEach(([s, cds]) => cds.forEach(c => csv += `${s};${c};${obrig.find(x=>x.codigo===c).nome}\n`));
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `plano_ufmt.csv`;
    link.click();
}

carregar();