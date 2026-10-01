(function(){
  var AGENDAMENTOS_KEY = 'studioAuraAgendamentos';
  var DISPONIBILIDADE_KEY = 'studioAuraDisponibilidade';
  var SERVICOS_KEY = 'studioAuraServicos';
  var PORTFOLIO_KEY = 'studioAuraPortfolio';
  var AUTH_KEY = 'studioAuraAdminAuth';
  var ACTION_AUTH_KEY = 'studioAuraAdminActionAuth';
  var LOCKOUT_KEY = 'studioAuraAdminLockout';
  var MAX_ATTEMPTS = 5;
  var LOCKOUT_MS = 20 * 60 * 1000;

  var gate = document.getElementById('adminGate');
  var panel = document.getElementById('adminPanel');
  if(!gate || !panel) return;

  var config = window.STUDIO_AURA_ADMIN || null;

  function defaultPortfolio(){
    return [
      { image:'images/portfolio/nails1.jpg', text:'Esmaltação em gel' },
      { image:'images/portfolio/lash1.jpg', text:'Lash designer' },
      { image:'images/portfolio/brow1.jpg', text:'Design de sobrancelha' },
      { image:'images/portfolio/hair1.jpg', text:'Tratamento capilar' },
      { image:'images/portfolio/nails2.jpg', text:'Pedicure' },
      { image:'images/portfolio/space.jpg', text:'O studio' },
      { image:'images/portfolio/lash2.jpg', text:'Produção especial' },
      { image:'images/portfolio/hair2.jpg', text:'Hair styling' }
    ];
  }

  function readList(key, fallback){
    try{
      var raw = localStorage.getItem(key);
      if(!raw){
        localStorage.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    }catch(err){ return fallback; }
  }
  function writeList(key, list){
    try{ localStorage.setItem(key, JSON.stringify(list)); }catch(err){}
  }

  // ---------- Gate ----------
  var passwordInput = document.getElementById('adminPasswordInput');
  var gateError = document.getElementById('adminGateError');
  var gateLocked = document.getElementById('adminGateLocked');
  var gateMissing = document.getElementById('adminGateMissing');
  var gateSubmit = document.getElementById('adminGateSubmit');
  var logoutBtn = document.getElementById('adminLogout');
  var lockInterval = null;

  function openPanel(){
    gate.hidden = true;
    panel.hidden = false;
    renderAgendamentos();
    renderDisponibilidade();
    renderServicos();
    renderPortfolio();
  }

  function getLockout(){
    try{
      var raw = localStorage.getItem(LOCKOUT_KEY);
      return raw ? JSON.parse(raw) : { attempts:0, lockUntil:0 };
    }catch(err){ return { attempts:0, lockUntil:0 }; }
  }
  function setLockout(state){
    try{ localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state)); }catch(err){}
  }

  function updateLockCountdown(){
    var state = getLockout();
    var remaining = state.lockUntil - Date.now();
    if(remaining <= 0){ applyLockUI(); return; }
    var mins = Math.floor(remaining / 60000);
    var secs = Math.floor((remaining % 60000) / 1000);
    gateLocked.textContent = 'Muitas tentativas incorretas. Tente novamente em ' + mins + ':' + (secs < 10 ? '0' : '') + secs + '.';
  }

  function applyLockUI(){
    var state = getLockout();
    var locked = state.lockUntil && Date.now() < state.lockUntil;
    if(locked){
      gateLocked.hidden = false;
      gateError.hidden = true;
      passwordInput.disabled = true;
      gateSubmit.disabled = true;
      updateLockCountdown();
      if(!lockInterval) lockInterval = setInterval(updateLockCountdown, 1000);
    }else{
      gateLocked.hidden = true;
      passwordInput.disabled = false;
      gateSubmit.disabled = false;
      if(lockInterval){ clearInterval(lockInterval); lockInterval = null; }
      if(state.lockUntil && Date.now() >= state.lockUntil){ setLockout({ attempts:0, lockUntil:0 }); }
    }
    return locked;
  }

  function tryLogin(){
    if(!config){ gateMissing.hidden = false; return; }
    gateMissing.hidden = true;
    if(applyLockUI()) return;

    if(passwordInput.value === config.password){
      gateError.hidden = true;
      setLockout({ attempts:0, lockUntil:0 });
      try{ sessionStorage.setItem(AUTH_KEY, '1'); }catch(err){}
      passwordInput.value = '';
      openPanel();
    }else{
      var state = getLockout();
      state.attempts = (state.attempts || 0) + 1;
      if(state.attempts >= MAX_ATTEMPTS){
        state.lockUntil = Date.now() + LOCKOUT_MS;
        state.attempts = 0;
        setLockout(state);
        passwordInput.value = '';
        applyLockUI();
      }else{
        setLockout(state);
        gateError.hidden = false;
        gateError.textContent = 'Senha incorreta. Tentativa ' + state.attempts + ' de ' + MAX_ATTEMPTS + '.';
      }
    }
  }

  if(gateSubmit) gateSubmit.addEventListener('click', tryLogin);
  if(passwordInput) passwordInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') tryLogin(); });
  if(logoutBtn) logoutBtn.addEventListener('click', function(){
    try{
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(ACTION_AUTH_KEY);
    }catch(err){}
    panel.hidden = true;
    gate.hidden = false;
  });

  applyLockUI();
  if(!config){
    gateMissing.hidden = false;
  } else {
    try{
      if(sessionStorage.getItem(AUTH_KEY) === '1') openPanel();
    }catch(err){}
  }

  // ---------- Tabs ----------
  var tabs = document.querySelectorAll('.admin-tab');
  var panels = document.querySelectorAll('.admin-content');
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      tabs.forEach(function(t){ t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      panels.forEach(function(p){ p.hidden = p.dataset.panel !== tab.dataset.tab; });
    });
  });

  // ---------- Confirm modal (action password) ----------
  var confirmOverlay = document.getElementById('adminConfirm');
  var confirmTitle = document.getElementById('adminConfirmTitle');
  var confirmText = document.getElementById('adminConfirmText');
  var confirmPasswordField = document.getElementById('adminConfirmPasswordField');
  var confirmPassword = document.getElementById('adminConfirmPassword');
  var confirmError = document.getElementById('adminConfirmError');
  var confirmOk = document.getElementById('adminConfirmOk');
  var confirmCancel = document.getElementById('adminConfirmCancel');
  var pendingAction = null;

  function isActionAuthed(){
    try{ return sessionStorage.getItem(ACTION_AUTH_KEY) === '1'; }catch(err){ return false; }
  }

  function askActionPassword(title, text, onConfirm){
    pendingAction = onConfirm;
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    confirmPassword.value = '';
    confirmError.hidden = true;
    var authed = isActionAuthed();
    confirmPasswordField.hidden = authed;
    confirmOverlay.hidden = false;
    if(authed) confirmOk.focus(); else confirmPassword.focus();
  }
  function closeConfirm(){
    confirmOverlay.hidden = true;
    pendingAction = null;
  }
  if(confirmCancel) confirmCancel.addEventListener('click', closeConfirm);
  if(confirmOverlay) confirmOverlay.addEventListener('click', function(e){ if(e.target === confirmOverlay) closeConfirm(); });
  if(confirmOk) confirmOk.addEventListener('click', function(){
    if(!isActionAuthed()){
      if(!config || confirmPassword.value !== config.actionPassword){
        confirmError.hidden = false;
        return;
      }
      try{ sessionStorage.setItem(ACTION_AUTH_KEY, '1'); }catch(err){}
    }
    var action = pendingAction;
    closeConfirm();
    if(action) action();
  });

  // ---------- Agendamentos ----------
  var agendamentosList = document.getElementById('agendamentosList');
  var agendamentosEmpty = document.getElementById('agendamentosEmpty');
  var agendamentosRefresh = document.getElementById('agendamentosRefresh');
  var agendamentosRefreshMsg = document.getElementById('agendamentosRefreshMsg');
  var knownAgendamentoIds = null;

  function renderAgendamentos(opts){
    var list = readList(AGENDAMENTOS_KEY, []);

    if(opts && opts.notifyNew){
      var currentIds = list.map(function(ag){ return ag.id; });
      var newCount = knownAgendamentoIds ? currentIds.filter(function(id){ return knownAgendamentoIds.indexOf(id) === -1; }).length : 0;
      if(agendamentosRefreshMsg){
        agendamentosRefreshMsg.textContent = newCount > 0
          ? newCount + ' novo' + (newCount > 1 ? 's' : '') + ' agendamento' + (newCount > 1 ? 's' : '') + '!'
          : 'Nenhum agendamento novo.';
      }
    }
    knownAgendamentoIds = list.map(function(ag){ return ag.id; });

    agendamentosList.innerHTML = '';
    agendamentosEmpty.hidden = list.length > 0;
    list.slice().reverse().forEach(function(ag){
      var card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML =
        '<span class="admin-card-status">' + (ag.status || 'pendente') + '</span>' +
        '<div class="admin-card-title"></div>' +
        '<div class="admin-card-row"><span>Cliente</span><strong></strong></div>' +
        '<div class="admin-card-row"><span>WhatsApp</span><strong></strong></div>' +
        '<div class="admin-card-row"><span>Data</span><strong></strong></div>' +
        '<div class="admin-card-row"><span>Horário</span><strong></strong></div>' +
        '<div class="admin-card-actions"></div>';
      var strongs = card.querySelectorAll('strong');
      card.querySelector('.admin-card-title').textContent = ag.servicoLabel || 'Serviço';
      strongs[0].textContent = ag.nome || '—';
      strongs[1].textContent = ag.whatsapp || '—';
      strongs[2].textContent = ag.data || '—';
      strongs[3].textContent = ag.horario || '—';

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'admin-btn-danger';
      delBtn.textContent = 'Apagar agendamento';
      delBtn.addEventListener('click', function(){
        askActionPassword('Apagar agendamento', 'Confirme a senha de ações para remover o agendamento de ' + (ag.nome || 'cliente') + '.', function(){
          var current = readList(AGENDAMENTOS_KEY, []);
          var next = current.filter(function(item){ return item.id !== ag.id; });
          writeList(AGENDAMENTOS_KEY, next);
          renderAgendamentos();
        });
      });
      card.querySelector('.admin-card-actions').appendChild(delBtn);
      agendamentosList.appendChild(card);
    });
  }

  if(agendamentosRefresh) agendamentosRefresh.addEventListener('click', function(){
    renderAgendamentos({ notifyNew:true });
  });

  // ---------- Disponibilidade ----------
  var dispForm = document.getElementById('disponibilidadeForm');
  var dispList = document.getElementById('disponibilidadeList');

  function formatDate(value){
    if(!value) return '—';
    var parts = value.split('-');
    if(parts.length !== 3) return value;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function renderDisponibilidade(){
    var list = readList(DISPONIBILIDADE_KEY, []).slice().sort(function(a,b){ return a.data < b.data ? -1 : 1; });
    dispList.innerHTML = '';
    list.forEach(function(item){
      var group = document.createElement('div');
      group.className = 'admin-date-group';
      var head = document.createElement('div');
      head.className = 'admin-date-head';
      var strong = document.createElement('strong');
      strong.textContent = formatDate(item.data);
      var removeDate = document.createElement('button');
      removeDate.type = 'button';
      removeDate.className = 'admin-btn-danger';
      removeDate.textContent = 'Remover data';
      removeDate.addEventListener('click', function(){
        askActionPassword('Remover data', 'Confirme a senha de ações para remover ' + formatDate(item.data) + ' da disponibilidade.', function(){
          var current = readList(DISPONIBILIDADE_KEY, []);
          writeList(DISPONIBILIDADE_KEY, current.filter(function(d){ return d.data !== item.data; }));
          renderDisponibilidade();
          if(window.StudioAuraBooking) window.StudioAuraBooking.refreshAvailability();
        });
      });
      head.appendChild(strong);
      head.appendChild(removeDate);
      group.appendChild(head);

      var chipRow = document.createElement('div');
      chipRow.className = 'admin-chip-row';
      (item.horarios || []).forEach(function(time){
        var chip = document.createElement('span');
        chip.className = 'admin-chip';
        var label = document.createElement('span');
        label.textContent = time;
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Remover horário ' + time);
        remove.addEventListener('click', function(){
          askActionPassword('Remover horário', 'Confirme a senha de ações para remover o horário ' + time + ' de ' + formatDate(item.data) + '.', function(){
            var current = readList(DISPONIBILIDADE_KEY, []);
            var entry = current.filter(function(d){ return d.data === item.data; })[0];
            if(entry){
              entry.horarios = entry.horarios.filter(function(t){ return t !== time; });
              if(!entry.horarios.length){
                current = current.filter(function(d){ return d.data !== item.data; });
              }
              writeList(DISPONIBILIDADE_KEY, current);
              renderDisponibilidade();
              if(window.StudioAuraBooking) window.StudioAuraBooking.refreshAvailability();
            }
          });
        });
        chip.appendChild(label);
        chip.appendChild(remove);
        chipRow.appendChild(chip);
      });
      group.appendChild(chipRow);
      dispList.appendChild(group);
    });
  }

  if(dispForm) dispForm.addEventListener('submit', function(e){
    e.preventDefault();
    var dateVal = document.getElementById('dispData').value;
    var timesRaw = document.getElementById('dispHorarios').value;
    if(!dateVal || !timesRaw.trim()) return;
    var times = timesRaw.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    if(!times.length) return;

    var list = readList(DISPONIBILIDADE_KEY, []);
    var existing = list.filter(function(d){ return d.data === dateVal; })[0];
    if(existing){
      times.forEach(function(t){ if(existing.horarios.indexOf(t) === -1) existing.horarios.push(t); });
      existing.horarios.sort();
    }else{
      list.push({ data: dateVal, horarios: times.sort() });
    }
    writeList(DISPONIBILIDADE_KEY, list);
    dispForm.reset();
    renderDisponibilidade();
    if(window.StudioAuraBooking) window.StudioAuraBooking.refreshAvailability();
  });

  // ---------- Serviços ----------
  var svcForm = document.getElementById('servicoForm');
  var svcList = document.getElementById('servicosList');
  var svcIconeSelect = document.getElementById('svcIcone');

  function defaultServices(){
    return [
      { id:'svc-cabelo', nome:'Cabelo', descricao:'Corte, escova e tratamento personalizados para o seu cabelo.', icone:'cabelo', cor:'primary' },
      { id:'svc-cilios', nome:'Cílios', descricao:'Extensão de cílios fio a fio ou volume russo para o seu olhar.', icone:'cilios', cor:'secondary' },
      { id:'svc-combo', nome:'Combo (Cabelo + Cílios)', descricao:'Una as duas experiências em um único horário reservado para você.', icone:'combo', cor:'secondary' }
    ];
  }

  if(svcIconeSelect && window.StudioAuraIcons){
    window.StudioAuraIcons.keys.forEach(function(key){
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = window.StudioAuraIcons.labels[key];
      svcIconeSelect.appendChild(opt);
    });
  }

  function renderServicos(){
    var list = readList(SERVICOS_KEY, defaultServices());
    svcList.innerHTML = '';
    list.forEach(function(svc){
      var card = document.createElement('div');
      card.className = 'service-option admin-service-preview';
      card.innerHTML =
        window.StudioAuraIcons.renderIcon(svc.icone, svc.cor) +
        '<span class="service-option-title"></span>' +
        '<span class="service-option-desc"></span>';
      card.querySelector('.service-option-title').textContent = svc.nome;
      card.querySelector('.service-option-desc').textContent = svc.descricao;

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'admin-btn-danger';
      removeBtn.textContent = 'Remover serviço';
      removeBtn.addEventListener('click', function(){
        askActionPassword('Remover serviço', 'Confirme a senha de ações para remover "' + svc.nome + '" das opções de agendamento.', function(){
          var current = readList(SERVICOS_KEY, defaultServices());
          var next = current.filter(function(s){ return s.id !== svc.id; });
          writeList(SERVICOS_KEY, next);
          renderServicos();
          if(window.StudioAuraBooking) window.StudioAuraBooking.refreshServices();
        });
      });
      card.appendChild(removeBtn);
      svcList.appendChild(card);
    });
  }

  if(svcForm) svcForm.addEventListener('submit', function(e){
    e.preventDefault();
    var nome = document.getElementById('svcNome').value.trim();
    var descricao = document.getElementById('svcDescricao').value.trim();
    var icone = document.getElementById('svcIcone').value;
    var cor = document.getElementById('svcCor').value;
    if(!nome || !descricao) return;

    askActionPassword('Adicionar serviço', 'Confirme a senha de ações para criar o serviço "' + nome + '".', function(){
      var list = readList(SERVICOS_KEY, defaultServices());
      list.push({ id:'svc-' + Date.now(), nome:nome, descricao:descricao, icone:icone, cor:cor });
      writeList(SERVICOS_KEY, list);
      svcForm.reset();
      renderServicos();
      if(window.StudioAuraBooking) window.StudioAuraBooking.refreshServices();
    });
  });

  // ---------- Portfólio ----------
  var pfForm = document.getElementById('portfolioForm');
  var pfList = document.getElementById('portfolioList');

  function renderPortfolio(){
    var list = readList(PORTFOLIO_KEY, defaultPortfolio());
    pfList.innerHTML = '';
    list.forEach(function(item, index){
      var thumb = document.createElement('div');
      thumb.className = 'admin-thumb';
      var img = document.createElement('img');
      img.src = item.image;
      img.alt = item.text || '';
      var body = document.createElement('div');
      body.className = 'admin-thumb-body';
      var span = document.createElement('span');
      span.textContent = item.text || '';
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'admin-btn-danger';
      removeBtn.textContent = 'Remover';
      removeBtn.addEventListener('click', function(){
        askActionPassword('Remover imagem', 'Confirme a senha de ações para remover "' + (item.text || 'esta imagem') + '" do portfólio.', function(){
          var current = readList(PORTFOLIO_KEY, defaultPortfolio());
          current.splice(index, 1);
          writeList(PORTFOLIO_KEY, current);
          renderPortfolio();
        });
      });
      body.appendChild(span);
      body.appendChild(removeBtn);
      thumb.appendChild(img);
      thumb.appendChild(body);
      pfList.appendChild(thumb);
    });
  }

  if(pfForm) pfForm.addEventListener('submit', function(e){
    e.preventDefault();
    var image = document.getElementById('pfImagem').value.trim();
    var text = document.getElementById('pfLegenda').value.trim();
    if(!image || !text) return;
    var list = readList(PORTFOLIO_KEY, defaultPortfolio());
    list.push({ image: image, text: text });
    writeList(PORTFOLIO_KEY, list);
    pfForm.reset();
    renderPortfolio();
  });
})();
