// DOM Elements
const searchSection = document.getElementById('searchSection');
const graphSection = document.getElementById('graphSection');
const wordInput = document.getElementById('wordInput');
const explodeBtn = document.getElementById('explodeBtn');
const backBtn = document.getElementById('backBtn');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const retryBtn = document.getElementById('retryBtn');
const graphSvg = document.getElementById('graphSvg');
const tooltip = document.getElementById('tooltip');

// State
let currentWord = '';
let simulation = null;

// Colors
const colors = {
  center: '#f59e0b',
  sinonimo: '#22c55e',
  contrario: '#ef4444',
  link: 'rgba(255, 255, 255, 0.15)'
};

// Event Listeners
explodeBtn.addEventListener('click', handleSearch);
wordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});
backBtn.addEventListener('click', resetToSearch);
retryBtn.addEventListener('click', () => {
  hideError();
  handleSearch();
});

// Focus input on load
wordInput.focus();

async function handleSearch() {
  const word = wordInput.value.trim();
  if (!word) {
    wordInput.focus();
    return;
  }

  currentWord = word;
  showLoading();

  try {
    const response = await fetch(`/api/search/${encodeURIComponent(word)}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || 'Errore nella ricerca');
    }

    if (data.sinonimi.length === 0 && data.contrari.length === 0) {
      throw new Error('Nessun sinonimo o contrario trovato per questa parola');
    }

    hideLoading();
    showGraph(data);

  } catch (error) {
    hideLoading();
    showError(error.message);
  }
}

function showLoading() {
  searchSection.classList.add('hidden');
  loading.classList.add('active');
  errorMessage.classList.remove('active');
}

function hideLoading() {
  loading.classList.remove('active');
}

function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.add('active');
}

function hideError() {
  errorMessage.classList.remove('active');
}

function resetToSearch() {
  graphSection.classList.remove('active');
  searchSection.classList.remove('hidden');
  wordInput.value = '';
  wordInput.focus();

  // Clear graph
  graphSvg.innerHTML = '';
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
}

function showGraph(data) {
  graphSection.classList.add('active');

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Clear previous graph
  graphSvg.innerHTML = '';

  // Create nodes and links
  const nodes = [];
  const links = [];

  // Center node (searched word)
  const centerNode = {
    id: 'center',
    word: data.word,
    type: 'center',
    radius: 45,
    x: width / 2,
    y: height / 2
  };
  nodes.push(centerNode);

  // Sinonimi nodes
  data.sinonimi.forEach((word, i) => {
    const node = {
      id: `sin-${i}`,
      word: word,
      type: 'sinonimo',
      radius: 30 + Math.random() * 10
    };
    nodes.push(node);
    links.push({
      source: 'center',
      target: node.id,
      type: 'sinonimo'
    });
  });

  // Contrari nodes
  data.contrari.forEach((word, i) => {
    const node = {
      id: `con-${i}`,
      word: word,
      type: 'contrario',
      radius: 30 + Math.random() * 10
    };
    nodes.push(node);
    links.push({
      source: 'center',
      target: node.id,
      type: 'contrario'
    });
  });

  // Create SVG elements
  const svg = d3.select(graphSvg)
    .attr('width', width)
    .attr('height', height);

  // Add gradient definitions
  const defs = svg.append('defs');

  // Glow filter
  const filter = defs.append('filter')
    .attr('id', 'glow')
    .attr('x', '-50%')
    .attr('y', '-50%')
    .attr('width', '200%')
    .attr('height', '200%');

  filter.append('feGaussianBlur')
    .attr('stdDeviation', '3')
    .attr('result', 'coloredBlur');

  const feMerge = filter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Links container
  const linkGroup = svg.append('g').attr('class', 'links');

  // Nodes container
  const nodeGroup = svg.append('g').attr('class', 'nodes');

  // Create links
  const linkElements = linkGroup.selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('class', 'link')
    .attr('stroke', d => d.type === 'sinonimo' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)')
    .attr('stroke-width', 2)
    .attr('opacity', 0);

  // Create node groups
  const nodeElements = nodeGroup.selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      if (d.type !== 'center') {
        wordInput.value = d.word;
        resetToSearch();
        setTimeout(() => handleSearch(), 100);
      }
    })
    .on('mouseenter', (event, d) => {
      if (d.type !== 'center') {
        tooltip.textContent = `Clicca per esplorare "${d.word}"`;
        tooltip.style.left = event.pageX + 15 + 'px';
        tooltip.style.top = event.pageY - 10 + 'px';
        tooltip.classList.add('visible');
      }
    })
    .on('mouseleave', () => {
      tooltip.classList.remove('visible');
    });

  // Add circles to nodes
  nodeElements.append('circle')
    .attr('class', 'node-circle')
    .attr('r', 0)
    .attr('fill', d => {
      if (d.type === 'center') return colors.center;
      if (d.type === 'sinonimo') return colors.sinonimo;
      return colors.contrario;
    })
    .attr('filter', 'url(#glow)');

  // Add text to nodes
  nodeElements.append('text')
    .attr('class', 'node-text')
    .attr('fill', 'white')
    .attr('font-size', d => d.type === 'center' ? '14px' : '11px')
    .attr('font-weight', d => d.type === 'center' ? '600' : '500')
    .text(d => truncateWord(d.word, d.radius));

  // Force simulation
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(150))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.radius + 20))
    .on('tick', ticked);

  function ticked() {
    // Keep nodes within bounds
    nodes.forEach(d => {
      d.x = Math.max(d.radius + 50, Math.min(width - d.radius - 50, d.x));
      d.y = Math.max(d.radius + 80, Math.min(height - d.radius - 50, d.y));
    });

    linkElements
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    nodeElements
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
  }

  // Animate entrance
  animateEntrance(nodeElements, linkElements, nodes);

  // Enable drag
  nodeElements.call(d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended));

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

function animateEntrance(nodeElements, linkElements, nodes) {
  // Animate center node first
  nodeElements.filter(d => d.type === 'center')
    .select('circle')
    .transition()
    .duration(400)
    .ease(d3.easeElasticOut.amplitude(1).period(0.5))
    .attr('r', d => d.radius);

  // Then animate other nodes with stagger
  nodeElements.filter(d => d.type !== 'center')
    .select('circle')
    .transition()
    .delay((d, i) => 200 + i * 50)
    .duration(500)
    .ease(d3.easeElasticOut.amplitude(1).period(0.5))
    .attr('r', d => d.radius);

  // Animate links
  linkElements
    .transition()
    .delay((d, i) => 300 + i * 30)
    .duration(300)
    .attr('opacity', 1);

  // Create explosion particles
  createExplosionEffect();
}

function createExplosionEffect() {
  const container = document.querySelector('.container');
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const angle = (Math.PI * 2 * i) / 20;
    const velocity = 100 + Math.random() * 150;
    const size = 3 + Math.random() * 4;

    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = centerX + 'px';
    particle.style.top = centerY + 'px';
    particle.style.background = [colors.center, colors.sinonimo, colors.contrario][Math.floor(Math.random() * 3)];
    particle.style.boxShadow = `0 0 ${size * 2}px ${particle.style.background}`;

    container.appendChild(particle);

    // Animate particle
    const destX = centerX + Math.cos(angle) * velocity;
    const destY = centerY + Math.sin(angle) * velocity;

    particle.animate([
      {
        transform: 'translate(0, 0) scale(1)',
        opacity: 1
      },
      {
        transform: `translate(${destX - centerX}px, ${destY - centerY}px) scale(0)`,
        opacity: 0
      }
    ], {
      duration: 600 + Math.random() * 400,
      easing: 'cubic-bezier(0, 0.5, 0.5, 1)'
    }).onfinish = () => particle.remove();
  }
}

function truncateWord(word, radius) {
  const maxLength = Math.floor(radius / 5);
  if (word.length > maxLength) {
    return word.substring(0, maxLength - 1) + '...';
  }
  return word;
}

// Handle window resize
window.addEventListener('resize', () => {
  if (graphSection.classList.contains('active') && simulation) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    d3.select(graphSvg)
      .attr('width', width)
      .attr('height', height);

    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
  }
});

// Load D3.js dynamically
function loadD3() {
  return new Promise((resolve, reject) => {
    if (window.d3) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://d3js.org/d3.v7.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize
loadD3().catch(err => {
  console.error('Failed to load D3.js:', err);
  showError('Errore nel caricamento della libreria grafica');
});
