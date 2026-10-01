window.StudioAuraIcons = (function(){
  var PATHS = {
    cabelo: ['<circle cx="16" cy="14" r="4"/><circle cx="16" cy="34" r="4"/><path d="M19 17l22 20M19 31l22-20" stroke-linecap="round"/>'],
    cilios: ['<path d="M6 24c6-9 13-13 18-13s12 4 18 13c-6 9-13 13-18 13S12 33 6 24Z"/><circle cx="24" cy="24" r="5"/><path d="M14 15l-3-4M34 15l3-4M24 10V5" stroke-linecap="round"/>'],
    unhas: ['<path d="M18 30c0-9 3-19 6-19s6 10 6 19c0 5-2.5 8-6 8s-6-3-6-8Z"/><path d="M20 15c1-1 3-1 4 0" stroke-linecap="round"/>'],
    sobrancelha: ['<path d="M8 30c4-12 12-18 20-18s12 4 12 4" stroke-linecap="round"/><circle cx="24" cy="30" r="7"/>'],
    estetica: ['<path d="M24 6c8 6 14 14 14 22a14 14 0 0 1-28 0c0-8 6-16 14-22Z"/><path d="M24 20v18" stroke-linecap="round"/>']
  };
  PATHS.combo = PATHS.cabelo.concat(PATHS.cilios);

  var LABELS = { cabelo:'Cabelo', cilios:'Cílios', unhas:'Unhas', sobrancelha:'Sobrancelha', estetica:'Estética', combo:'Combo (Cabelo + Cílios)' };

  function svgSet(key){
    var set = PATHS[key] || PATHS.estetica;
    return set.map(function(p){
      return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4">' + p + '</svg>';
    }).join('');
  }

  function renderIcon(key, cor){
    var cls = 'service-option-icon service-option-icon--' + (cor === 'primary' ? 'primary' : 'secondary');
    if(key === 'combo') cls += ' service-option-icon--combo';
    return '<span class="' + cls + '">' + svgSet(key) + '</span>';
  }

  return { renderIcon: renderIcon, labels: LABELS, keys: Object.keys(LABELS) };
})();

(function(){
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger) && !reduceMotion;

  // Scroll reveal
  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var servicesEl = document.querySelector('.services.reveal');
  if(servicesEl){
    var svcIdx = items.indexOf(servicesEl);
    if(svcIdx > -1) items.splice(svcIdx, 1);
  }

  if(hasGsap){
    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add('gsap-ready');

    items.forEach(function(el){
      gsap.fromTo(el, { autoAlpha:0, y:28 }, {
        autoAlpha:1, y:0, duration:0.9, ease:'power2.out',
        scrollTrigger:{ trigger: el, start:'top 85%' }
      });
    });

    if(servicesEl){
      gsap.set(servicesEl, { autoAlpha:1 });
      gsap.fromTo(servicesEl.querySelectorAll('.service'), { autoAlpha:0, y:26 }, {
        autoAlpha:1, y:0, duration:0.7, ease:'power2.out', stagger:0.1,
        scrollTrigger:{ trigger: servicesEl, start:'top 85%' }
      });
    }

    var hero = document.querySelector('.hero');
    if(hero){
      gsap.timeline({ defaults:{ ease:'power2.out', duration:0.9 } })
        .from('.hero .eyebrow', { autoAlpha:0, y:16 })
        .from('.hero h1', { autoAlpha:0, y:26 }, '-=0.55')
        .from('.hero-lede', { autoAlpha:0, y:20 }, '-=0.55')
        .from('.hero-actions', { autoAlpha:0, y:16 }, '-=0.5')
        .from('.hero-art', { autoAlpha:0, scale:0.95 }, '-=0.7');
    }

    window.addEventListener('load', function(){ ScrollTrigger.refresh(); });
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(function(){ ScrollTrigger.refresh(); });
    }
  } else {
    if(servicesEl) items.push(servicesEl);
    if('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); }
        });
      },{threshold:0.15});
      items.forEach(function(el){ io.observe(el); });
    } else {
      items.forEach(function(el){ el.classList.add('is-visible'); });
    }
  }

  // Close mobile menu after choosing a link
  var toggle = document.getElementById('menu-toggle');
  document.querySelectorAll('.nav-links a').forEach(function(a){
    a.addEventListener('click', function(){ if(toggle) toggle.checked = false; });
  });

  // Booking form
  var step1 = document.getElementById('bookingStep1');
  var step2 = document.getElementById('bookingStep2');
  if(step1 && step2){
    var AVAILABILITY_KEY = 'studioAuraDisponibilidade';
    var SERVICES_KEY = 'studioAuraServicos';
    var serviceSelect = document.getElementById('serviceSelect');
    var dataSelect = document.getElementById('bkData');
    var horarioBox = document.getElementById('bkHorarioSelect');
    var activeTime = null;
    var currentServiceId = null;
    var whatsInput = document.getElementById('bkWhats');
    var summaryCard = step2.querySelector('.booking-summary');
    var successBox = document.getElementById('bookingSuccess');

    function pad(n){ return n < 10 ? '0' + n : '' + n; }
    function isoInDays(n){
      var d = new Date();
      d.setDate(d.getDate() + n);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function defaultAvailability(){
      return [
        { data: isoInDays(2), horarios: ['10:30','14:00','16:30'] },
        { data: isoInDays(4), horarios: ['09:00','11:00','15:00'] },
        { data: isoInDays(6), horarios: ['10:00','13:30'] }
      ];
    }

    function getAvailability(){
      try{
        var raw = localStorage.getItem(AVAILABILITY_KEY);
        if(!raw){
          var seeded = defaultAvailability();
          localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(seeded));
          return seeded;
        }
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }catch(err){
        return [];
      }
    }

    function defaultServices(){
      return [
        { id:'svc-cabelo', nome:'Cabelo', descricao:'Corte, escova e tratamento personalizados para o seu cabelo.', icone:'cabelo', cor:'primary' },
        { id:'svc-cilios', nome:'Cílios', descricao:'Extensão de cílios fio a fio ou volume russo para o seu olhar.', icone:'cilios', cor:'secondary' },
        { id:'svc-combo', nome:'Combo (Cabelo + Cílios)', descricao:'Una as duas experiências em um único horário reservado para você.', icone:'combo', cor:'secondary' }
      ];
    }

    function getServices(){
      try{
        var raw = localStorage.getItem(SERVICES_KEY);
        if(!raw){
          var seeded = defaultServices();
          localStorage.setItem(SERVICES_KEY, JSON.stringify(seeded));
          return seeded;
        }
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length ? parsed : defaultServices();
      }catch(err){
        return defaultServices();
      }
    }

    function renderServiceOptions(){
      var services = getServices();
      serviceSelect.innerHTML = '';
      services.forEach(function(svc, i){
        var label = document.createElement('label');
        label.className = 'service-option' + (i === 0 ? ' is-selected' : '');
        label.innerHTML =
          '<input type="radio" name="servico" value="' + svc.id + '"' + (i === 0 ? ' checked' : '') + '>' +
          StudioAuraIcons.renderIcon(svc.icone, svc.cor) +
          '<span class="service-option-title"></span>' +
          '<span class="service-option-desc"></span>';
        label.querySelector('.service-option-title').textContent = svc.nome;
        label.querySelector('.service-option-desc').textContent = svc.descricao;
        label.addEventListener('click', function(){
          serviceSelect.querySelectorAll('.service-option').forEach(function(o){ o.classList.remove('is-selected'); });
          label.classList.add('is-selected');
          label.querySelector('input').checked = true;
          currentServiceId = svc.id;
        });
        serviceSelect.appendChild(label);
      });
      currentServiceId = services.length ? services[0].id : null;
    }

    function selectedService(){
      var services = getServices();
      var checked = step1.querySelector('input[name="servico"]:checked');
      var id = checked ? checked.value : currentServiceId;
      var found = services.filter(function(s){ return s.id === id; })[0];
      return found || services[0];
    }

    function renderDateOptions(){
      var availability = getAvailability().slice().sort(function(a,b){ return a.data < b.data ? -1 : 1; });
      dataSelect.innerHTML = '<option value="" disabled selected>Selecione uma data</option>';
      availability.forEach(function(item){
        if(!item.horarios || !item.horarios.length) return;
        var opt = document.createElement('option');
        opt.value = item.data;
        opt.textContent = formatDate(item.data);
        dataSelect.appendChild(opt);
      });
      renderTimeChips(null);
    }

    function renderTimeChips(dateValue){
      horarioBox.innerHTML = '';
      activeTime = null;
      if(!dateValue){
        var hint = document.createElement('span');
        hint.className = 'time-select-empty';
        hint.textContent = 'Escolha uma data primeiro';
        horarioBox.appendChild(hint);
        return;
      }
      var availability = getAvailability();
      var match = availability.filter(function(item){ return item.data === dateValue; })[0];
      var horarios = match ? match.horarios : [];
      if(!horarios || !horarios.length){
        var empty = document.createElement('span');
        empty.className = 'time-select-empty';
        empty.textContent = 'Sem horários disponíveis nesta data';
        horarioBox.appendChild(empty);
        return;
      }
      horarios.forEach(function(time, i){
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'time-chip' + (i === 0 ? ' is-active' : '');
        chip.dataset.time = time;
        chip.textContent = time;
        chip.addEventListener('click', function(){
          horarioBox.querySelectorAll('.time-chip').forEach(function(c){ c.classList.remove('is-active'); });
          chip.classList.add('is-active');
          activeTime = chip;
        });
        horarioBox.appendChild(chip);
      });
      activeTime = horarioBox.querySelector('.time-chip.is-active');
    }

    dataSelect.addEventListener('change', function(){
      renderTimeChips(dataSelect.value || null);
    });

    if(whatsInput){
      whatsInput.addEventListener('input', function(){
        var digits = whatsInput.value.replace(/\D/g,'').slice(0,11);
        var out = digits;
        if(digits.length > 2) out = '(' + digits.slice(0,2) + ') ' + digits.slice(2);
        if(digits.length > 7) out = '(' + digits.slice(0,2) + ') ' + digits.slice(2,7) + '-' + digits.slice(7);
        whatsInput.value = out;
      });
    }

    function formatDate(value){
      if(!value) return '—';
      var parts = value.split('-');
      if(parts.length !== 3) return value;
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }

    step1.addEventListener('submit', function(e){
      e.preventDefault();
      var nome = document.getElementById('bkNome');
      var data = dataSelect;
      var valid = true;
      [nome, data].forEach(function(field){
        field.classList.remove('has-error');
        if(!field.value.trim()){ field.classList.add('has-error'); valid = false; }
      });
      if(whatsInput){
        whatsInput.classList.remove('has-error');
        if(whatsInput.value.replace(/\D/g,'').length < 10){ whatsInput.classList.add('has-error'); valid = false; }
      }
      horarioBox.classList.remove('has-error');
      if(!activeTime){ horarioBox.classList.add('has-error'); valid = false; }
      if(!valid) return;

      var service = selectedService();
      document.getElementById('summaryServico').textContent = service.nome;
      document.getElementById('summaryNome').textContent = nome.value.trim();
      document.getElementById('summaryWhats').textContent = whatsInput.value;
      document.getElementById('summaryData').textContent = formatDate(data.value);
      document.getElementById('summaryHorario').textContent = activeTime ? activeTime.dataset.time : '—';
      document.getElementById('summaryIcon').innerHTML = StudioAuraIcons.renderIcon(service.icone, service.cor);

      step1.hidden = true;
      step2.hidden = false;
      summaryCard.hidden = false;
      successBox.hidden = true;
      window.scrollTo({ top: step2.getBoundingClientRect().top + window.scrollY - 110, behavior:'smooth' });
    });

    var editBtn = document.getElementById('bookingEdit');
    if(editBtn){
      editBtn.addEventListener('click', function(){
        step2.hidden = true;
        step1.hidden = false;
        window.scrollTo({ top: step1.getBoundingClientRect().top + window.scrollY - 110, behavior:'smooth' });
      });
    }

    var confirmBtn = document.getElementById('bookingConfirm');
    if(confirmBtn){
      confirmBtn.addEventListener('click', function(){
        var service = selectedService();
        var appointment = {
          id: Date.now(),
          servicoId: service.id,
          servicoLabel: document.getElementById('summaryServico').textContent,
          nome: document.getElementById('summaryNome').textContent,
          whatsapp: document.getElementById('summaryWhats').textContent,
          data: document.getElementById('summaryData').textContent,
          horario: document.getElementById('summaryHorario').textContent,
          criadoEm: new Date().toISOString(),
          status: 'pendente'
        };
        try{
          var list = JSON.parse(localStorage.getItem('studioAuraAgendamentos') || '[]');
          list.push(appointment);
          localStorage.setItem('studioAuraAgendamentos', JSON.stringify(list));
        }catch(err){}

        summaryCard.hidden = true;
        successBox.hidden = false;
      });
    }

    var newBtn = document.getElementById('bookingNew');
    if(newBtn){
      newBtn.addEventListener('click', function(){
        step1.reset();
        renderServiceOptions();
        renderDateOptions();
        step2.hidden = true;
        step1.hidden = false;
        window.scrollTo({ top: step1.getBoundingClientRect().top + window.scrollY - 110, behavior:'smooth' });
      });
    }

    renderServiceOptions();
    renderDateOptions();

    window.StudioAuraBooking = {
      refreshServices: renderServiceOptions,
      refreshAvailability: renderDateOptions
    };
  }
})();
