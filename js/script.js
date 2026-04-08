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
    "2029/2": { "20261": [2, 4, 6, 8, 9, 10], "20251": [] } // 2025/1 Extinto
};

async function carregar() {
    try {
        const res = await fetch('./data/disciplinas_obrigatorias.json');
        obrig = await res.json();
        const sems = Object.keys(plano).sort();
        if (sems.length > 0) semestreAtivo = sems[sems.length - 1];
        carregarInfoAdicional();
        renderizarTudo();
    } catch (e) { alert("Erro ao carregar dados."); }
}

function salvarInfoAdicional() {
    const info = {
        nome: document.getElementById('alunoNome').value,
        rga: document.getElementById('alunoRGA').value,
        sei: document.getElementById('alunoSEI').value
    };
    localStorage.setItem('info_aluno_ufmt', JSON.stringify(info));
}

function carregarInfoAdicional() {
    const info = JSON.parse(localStorage.getItem('info_aluno_ufmt'));
    if (info) {
        document.getElementById('alunoNome').value = info.nome || "";
        document.getElementById('alunoRGA').value = info.rga || "";
        document.getElementById('alunoSEI').value = info.sei || "";
    }
}

function calcularProximoSemestre(ultimo) {
    let [ano, periodo] = ultimo.split('/').map(Number);
    return periodo === 1 ? `${ano}/2` : `${ano + 1}/1`;
}

function renderizarTudo() {
    const ppc = document.getElementById('filtroPPC').value;
    const ppcKey = `ppc_${ppc}`;
    const mapaPlano = {};
    Object.entries(plano).forEach(([sem, cods]) => cods.forEach(c => mapaPlano[c] = sem));

    const boxHistorico = document.getElementById('checklistObrigatorias');
    boxHistorico.innerHTML = '';
    const semestres = {};
    obrig.forEach(d => {
        if (d[ppcKey]) {
            if (!semestres[d[ppcKey]]) semestres[d[ppcKey]] = [];
            semestres[d[ppcKey]].push(d);
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
            const planejado = mapaPlano[d.codigo];
            const preReqs = (d.prerequisitos || []).map(c => obrig.find(o => o.codigo === c)?.nome || c).join(', ');
            const item = document.createElement('div');
            item.className = `item-check ${isChecked ? 'active' : ''} ${planejado ? 'is-planned' : ''}`;
            item.innerHTML = `
                <input type="checkbox" id="c-${d.codigo}" ${isChecked ? 'checked' : ''} onchange="toggle('${d.codigo}')">
                <label for="c-${d.codigo}">
                    <strong>${d.codigo}</strong><small>${d.nome}</small>
                    ${planejado ? `<div class="badge-plano-screen">📅 Planejada: ${planejado}</div>` : ''}
                    ${preReqs ? `<div class="info-pre-historico">Req: ${preReqs}</div>` : ''}
                </label>`;
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
    box.innerHTML = semestreAtivo ? '' : '<p style="padding:10px; font-size:0.8rem; color:red">Selecione um semestre abaixo.</p>';
    if (!semestreAtivo) return;

    const jaPlano = Object.values(plano).flat();
    const oferta = REGRAS_OFERTA[semestreAtivo];
    const [anoAtivo, periodoAtivo] = semestreAtivo.split('/').map(Number);

    obrig.filter(d => {
        let estaOfertada = false;

        if (oferta) {
            // Lógica durante a transição (2026/1 até 2029/2)
            if (d.ppc_20261 && oferta["20261"].includes(d.ppc_20261)) estaOfertada = true;
            if (d.ppc_20251 && oferta["20251"].includes(d.ppc_20251)) estaOfertada = true;
        } else if (anoAtivo >= 2030 || (anoAtivo === 2029 && periodoAtivo === 2)) {
            // LÓGICA DE EXTINÇÃO: A partir de 2029/2 ou 2030+, o PPC 2025/1 NÃO EXISTE MAIS.
            // Apenas disciplinas que estão no PPC 2026/1 são ofertadas,
            // respeitando paridade (ímpar no /1 e par no /2)
            const semestreDesejado = d.ppc_20261;
            if (semestreDesejado) {
                if (periodoAtivo === 1 && semestreDesejado % 2 !== 0) estaOfertada = true;
                if (periodoAtivo === 2 && semestreDesejado % 2 === 0) estaOfertada = true;
            }
        } else {
            // Fallback para datas antes de 2026
            estaOfertada = !!d[ppcKey];
        }

        return estaOfertada && !cursadas.includes(d.codigo) && !jaPlano.includes(d.codigo);
    }).forEach(d => {
        const preReqCodes = d.prerequisitos || [];
        const preReqNomes = preReqCodes.map(c => obrig.find(o => o.codigo === c)?.nome || c).join(', ');
        const cumpre = preReqCodes.every(p => cursadas.includes(p));

        const div = document.createElement('div');
        div.className = `mini-card ${!cumpre ? 'alerta-pre' : ''}`;
        div.innerHTML = `
            <div class="info-pendente">
                <strong>${d.codigo}</strong><small>${d.nome}</small>
                <div class="tag-pre">${preReqNomes ? 'Req: ' + preReqNomes : 'Livre'}</div>
            </div>
            <button onclick="addAoPlano('${d.codigo}')">ADD</button>`;
        box.appendChild(div);
    });
}

function renderizarGrade() {
    const box = document.getElementById('gradeSemestres');
    box.innerHTML = '';
    Object.entries(plano).forEach(([sem, cods]) => {
        let cr = 0;
        const col = document.createElement('div');
        col.className = `coluna-semestre ${sem === semestreAtivo ? 'semestre-selecionado' : ''}`;
        col.onclick = () => { semestreAtivo = sem; renderizarTudo(); };
        const lista = document.createElement('div');
        lista.className = 'lista-disciplinas-vertical';
        cods.forEach(c => {
            const d = obrig.find(x => x.codigo === c);
            if (d) {
                cr += (parseInt(d.carga_horaria) || 0) / 16;
                const item = document.createElement('div');
                item.className = 'card-disciplina';
                item.innerHTML = `<label><strong>${c}</strong><br><small>${d.nome}</small></label><b onclick="event.stopPropagation(); delDisc('${sem}','${c}')" style="color:red; cursor:pointer">×</b>`;
                lista.appendChild(item);
            }
        });
        col.innerHTML = `<h4>${sem === semestreAtivo ? '📌 ' : ''}${sem} <span class="badge-creditos ${cr > 36 ? 'excesso-creditos' : ''}">${cr} CR</span> <span onclick="event.stopPropagation(); removerSemestre('${sem}')">🗑</span></h4>`;
        col.appendChild(lista);
        box.appendChild(col);
    });
}

function toggle(c) {
    if(cursadas.includes(c)) cursadas = cursadas.filter(x => x !== c);
    else { cursadas.push(c); Object.keys(plano).forEach(s => plano[s] = plano[s].filter(x => x !== c)); }
    renderizarTudo();
}
function addAoPlano(c) { if(semestreAtivo) { plano[semestreAtivo].push(c); renderizarTudo(); } }
function delDisc(s, c) { plano[s] = plano[s].filter(x => x !== c); renderizarTudo(); }
function removerSemestre(s) {
    if(confirm(`Deseja remover o semestre ${s} e todas as disciplinas planejadas nele?`)) {
        delete plano[s];
        semestreAtivo = "";
        renderizarTudo();
    }
}
function addSemestre() {
    let sems = Object.keys(plano).sort();
    let n = sems.length ? calcularProximoSemestre(sems[sems.length-1]) : prompt("Início (Ex: 2026/1)");
    if(n && !plano[n]) { plano[n] = []; semestreAtivo = n; renderizarTudo(); }
}
function limparDados() { if(confirm("Resetar?")) { localStorage.clear(); location.reload(); } }
function gerarPDF() { window.print(); }
function exportarExcel() {
    const nome = document.getElementById('alunoNome').value || "aluno";
    let csv = "PLANEJAMENTO;Codigo;Disciplina\n";
    Object.entries(plano).forEach(([s, cds]) => cds.forEach(c => csv += `${s};${c};${obrig.find(x=>x.codigo===c).nome}\n`));
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `plano_${nome}.csv`; link.click();
}

carregar();