// Global variables
let users = JSON.parse(localStorage.getItem('networkAnalyzerUsers')) || [];
let currentUser = null;
let monitoringActive = false;
let refreshInterval = 5000;
let trafficChart = null;
let resourceChart = null;
let trafficAnalyticsChart = null;
let predictiveChart = null;
let healthScoreGauge = null;
let networkTopology = null;
let topologyNetwork = null;
let currentTab = 'dashboard';

let networkData = {
  connections: 0,
  latency: 0,
  status: 'Monitoring...',
  alerts: 0,
  traffic: [],
  resources: { cpu: 0, memory: 0, disk: 0 }
};

let alertsHistory = JSON.parse(localStorage.getItem('networkAlerts')) || [];
let monitoringTimer = null;
let userPreferences = JSON.parse(localStorage.getItem('userPreferences')) || {};
let analyticsData = [];
let networkDevices = [];
let networkEvents = [];
let topTalkers = [];

// Network Command Database
const networkCommands = {
  'err-disabled': [
    'show interfaces status err-disabled',
    'show errdisable recovery',
    'show spanning-tree interface detail',
    'show port-security interface',
    'errdisable recovery cause all'
  ],
  'bgp': [
    'show ip bgp summary',
    'show ip bgp neighbors',
    'show ip route bgp',
    'show ip bgp',
    'clear ip bgp *',
    'debug ip bgp updates'
  ],
  'ospf': [
    'show ip ospf neighbor',
    'show ip ospf database',
    'show ip ospf interface',
    'show ip route ospf',
    'debug ip ospf adj',
    'show ip ospf border-routers'
  ],
  'cpu': [
    'show processes cpu sorted',
    'show processes memory sorted',
    'show memory summary',
    'show cpu usage',
    'monitor processes cpu'
  ],
  'memory': [
    'show memory summary',
    'show processes memory sorted',
    'show memory fragmentation',
    'show buffers',
    'show memory heap summary'
  ],
  'interface': [
    'show interfaces',
    'show interfaces description',
    'show interfaces status',
    'show interfaces counters',
    'show interfaces trunk'
  ],
  'authentication': [
    'show aaa sessions',
    'show authentication sessions',
    'show tacacs',
    'show radius statistics',
    'debug aaa authentication'
  ],
  'general': [
    'show version',
    'show running-config',
    'show ip interface brief',
    'show cdp neighbors',
    'show lldp neighbors',
    'show inventory',
    'show environment',
    'show logging',
    'ping 8.8.8.8',
    'traceroute 8.8.8.8'
  ]
};

// Initialize application on page load
document.addEventListener('DOMContentLoaded', function() {
  loadUserSession();
  setupAutoSave();
});

// Tab Management Functions
function showTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Remove active class from all tab buttons
  document.querySelectorAll('.nav-tab').forEach(button => {
    button.classList.remove('active');
  });
  
  // Show selected tab content
  document.getElementById(tabName + '-tab').classList.add('active');
  
  // Add active class to clicked button
  event.target.classList.add('active');
  
  currentTab = tabName;
  
  // Initialize tab-specific content
  switch(tabName) {
    case 'topology':
      initializeTopology();
      break;
    case 'analytics':
      initializeAnalytics();
      break;
  }
}

// User Persistence Functions
function loadUserSession() {
  const savedSession = localStorage.getItem('currentNetworkSession');
  if (savedSession) {
    const sessionData = JSON.parse(savedSession);
    const user = users.find(u => u.name === sessionData.username);
    if (user && sessionData.timestamp > Date.now() - (7 * 24 * 60 * 60 * 1000)) { // 7 days
      currentUser = user;
      document.getElementById("auth-container").style.display = "none";
      document.getElementById("main-app").style.display = "block";
      document.getElementById("current-user-display").textContent = `Welcome back, ${user.name}!`;
      
      loadUserPreferences();
      initializeDashboard();
    }
  }
}

function saveUserSession(user) {
  localStorage.setItem('currentNetworkSession', JSON.stringify({
    username: user.name,
    timestamp: Date.now()
  }));
}

function saveUserPreferences() {
  userPreferences[currentUser.name] = {
    refreshRate: refreshInterval,
    autoMonitoring: monitoringActive,
    theme: 'premium',
    lastLogin: Date.now(),
    preferredTab: currentTab
  };
  localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
}

function loadUserPreferences() {
  const prefs = userPreferences[currentUser.name];
  if (prefs) {
    refreshInterval = prefs.refreshRate || 5000;
    document.getElementById('refresh-rate').value = refreshInterval;
    document.getElementById('auto-monitor').checked = prefs.autoMonitoring !== false;
    monitoringActive = prefs.autoMonitoring !== false;
  }
}

function setupAutoSave() {
  // Auto-save users and alerts every 30 seconds
  setInterval(() => {
    localStorage.setItem('networkAnalyzerUsers', JSON.stringify(users));
    localStorage.setItem('networkAlerts', JSON.stringify(alertsHistory.slice(0, 100)));
    if (currentUser) {
      saveUserPreferences();
    }
  }, 30000);
}

// Authentication Functions
function showRegister() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("register-section").style.display = "block";
  
  // Clear any previous messages
  document.getElementById("register-msg").textContent = "";
  document.getElementById("login-error").textContent = "";
}

function showLogin() {
  document.getElementById("register-section").style.display = "none";
  document.getElementById("login-section").style.display = "block";
  
  // Clear any previous messages
  document.getElementById("register-msg").textContent = "";
  document.getElementById("login-error").textContent = "";
}

function register() {
  const username = document.getElementById("new-username").value.trim();
  const password = document.getElementById("new-password").value.trim();
  
  if (!username || !password) {
    document.getElementById("register-msg").innerHTML = `
      <div style="color: #f44336; text-align: center;">
        ❌ Please fill both username and password fields.
      </div>
    `;
    return;
  }
  
  if (password.length < 6) {
    document.getElementById("register-msg").innerHTML = `
      <div style="color: #f44336; text-align: center;">
        ⚠️ Password must be at least 6 characters long for security.
      </div>
    `;
    return;
  }
  
  const exists = users.find(u => u.name === username);
  if (exists) {
    document.getElementById("register-msg").innerHTML = `
      <div style="color: #f44336; text-align: center;">
        🚫 Network Administrator "${username}" already exists. Choose a different username.
      </div>
    `;
    return;
  }
  
  const newUser = {
    name: username,
    password,
    joinDate: new Date().toISOString(),
    role: 'Senior Network Administrator',
    loginCount: 0,
    lastLogin: null
  };
  
  users.push(newUser);
  localStorage.setItem('networkAnalyzerUsers', JSON.stringify(users));
  
  // Success message with network theme
  document.getElementById("register-msg").innerHTML = `
    <div style="color: #4caf50; text-align: center;">
      🎉 Network Administrator account created successfully!<br>
      <small style="opacity: 0.8;">Redirecting to secure login portal...</small>
    </div>
  `;
  
  // Clear input fields
  document.getElementById("new-username").value = "";
  document.getElementById("new-password").value = "";
  
  // Auto-redirect to login after 2 seconds with smooth animation
  setTimeout(() => {
    document.getElementById("register-section").style.opacity = "0.5";
    setTimeout(() => {
      showLogin();
      document.getElementById("register-section").style.opacity = "1";
      
      // Add welcome message to login screen
      document.getElementById("login-error").innerHTML = `
        <div style="color: #4caf50; text-align: center; margin-bottom: 15px;">
          ✅ Account created! Please sign in with your credentials.
        </div>
      `;
      
      // Pre-fill username for convenience
      document.getElementById("username").value = username;
      document.getElementById("password").focus();
    }, 300);
  }, 2000);
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  
  const found = users.find(u => u.name === username && u.password === password);
  if (found) {
    currentUser = found;
    found.loginCount = (found.loginCount || 0) + 1;
    found.lastLogin = new Date().toISOString();
    
    document.getElementById("auth-container").style.display = "none";
    document.getElementById("main-app").style.display = "block";
    document.getElementById("current-user-display").innerHTML = `
      <div>Welcome, <strong>${username}</strong>!</div>
      <small>Login #${found.loginCount} | ${found.role || 'Network Analyst'}</small>
    `;
    
    saveUserSession(found);
    loadUserPreferences();
    initializeDashboard();
    
    // Show welcome notification
    addAlert({
      type: 'info',
      message: `Welcome back ${username}! Network monitoring resumed.`,
      timestamp: new Date()
    });
  } else {
    document.getElementById("login-error").textContent = "❌ Invalid credentials! Please try again.";
  }
}

function logout() {
  currentUser = null;
  monitoringActive = false;
  if (monitoringTimer) clearInterval(monitoringTimer);
  
  localStorage.removeItem('currentNetworkSession');
  
  document.getElementById("main-app").style.display = "none";
  document.getElementById("auth-container").style.display = "block";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("login-error").textContent = "";
  
  // Reset charts
  if (trafficChart) trafficChart.destroy();
  if (resourceChart) resourceChart.destroy();
  if (trafficAnalyticsChart) trafficAnalyticsChart.destroy();
  if (predictiveChart) predictiveChart.destroy();
  if (healthScoreGauge) healthScoreGauge.destroy();
  if (topologyNetwork) topologyNetwork.destroy();
}

// Dashboard Initialization
function initializeDashboard() {
  initializeCharts();
  generateInitialNetworkDevices();
  startRealTimeMonitoring();
  displayWelcomeMessage();
  updateNetworkCommandSuggestions();
}

function displayWelcomeMessage() {
  const welcomeMessages = [
    'Enterprise network monitoring system initialized',
    'All systems operational - topology mapping active',
    'Ready for advanced incident analysis',
    'Monitoring infrastructure health across all segments'
  ];
  
  addAlert({
    type: 'info',
    message: welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)],
    timestamp: new Date()
  });
}

function initializeCharts() {
  // Traffic Chart with enhanced styling
  const trafficCtx = document.getElementById('trafficChart')?.getContext('2d');
  if (trafficCtx) {
    trafficChart = new Chart(trafficCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Incoming Traffic (Mbps)',
          data: [],
          borderColor: '#00bcd4',
          backgroundColor: 'rgba(0, 188, 212, 0.1)',
          tension: 0.4,
          fill: true
        }, {
          label: 'Outgoing Traffic (Mbps)',
          data: [],
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { 
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#fff' }
          },
          x: { 
            display: false,
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        },
        plugins: {
          legend: { 
            labels: { color: '#fff', font: { size: 12 } }
          }
        },
        animation: { duration: 750 }
      }
    });
  }

  // Resource Chart with enhanced styling
  const resourceCtx = document.getElementById('resourceChart')?.getContext('2d');
  if (resourceCtx) {
    resourceChart = new Chart(resourceCtx, {
      type: 'doughnut',
      data: {
        labels: ['CPU Usage', 'Memory Usage', 'Disk Usage'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: ['#e74c3c', '#f39c12', '#2ecc71'],
          borderColor: '#fff',
          borderWidth: 3,
          hoverBorderWidth: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            labels: { color: '#fff', font: { size: 12 } }
          }
        },
        animation: { animateRotate: true, duration: 1000 }
      }
    });
  }
}

// Network Topology Functions
function generateInitialNetworkDevices() {
  networkDevices = [
    { id: 'core-switch-1', label: 'Core Switch 1', type: 'switch', ip: '192.168.1.1', status: 'active', x: 0, y: 0 },
    { id: 'core-switch-2', label: 'Core Switch 2', type: 'switch', ip: '192.168.1.2', status: 'active', x: 200, y: 0 },
    { id: 'router-1', label: 'Border Router', type: 'router', ip: '10.0.0.1', status: 'active', x: 100, y: -150 },
    { id: 'firewall-1', label: 'Main Firewall', type: 'firewall', ip: '192.168.1.10', status: 'active', x: 100, y: 150 },
    { id: 'server-1', label: 'Web Server', type: 'server', ip: '192.168.2.10', status: 'active', x: -200, y: 100 },
    { id: 'server-2', label: 'Database Server', type: 'server', ip: '192.168.2.11', status: 'active', x: 400, y: 100 },
    { id: 'switch-1', label: 'Access Switch 1', type: 'switch', ip: '192.168.3.1', status: 'active', x: -200, y: 200 },
    { id: 'switch-2', label: 'Access Switch 2', type: 'switch', ip: '192.168.3.2', status: 'active', x: 400, y: 200 },
    { id: 'endpoint-1', label: 'Workstation 1', type: 'endpoint', ip: '192.168.3.10', status: 'active', x: -300, y: 300 },
    { id: 'endpoint-2', label: 'Workstation 2', type: 'endpoint', ip: '192.168.3.11', status: 'active', x: -100, y: 300 },
    { id: 'endpoint-3', label: 'Workstation 3', type: 'endpoint', ip: '192.168.3.12', status: 'active', x: 300, y: 300 },
    { id: 'endpoint-4', label: 'Workstation 4', type: 'endpoint', ip: '192.168.3.13', status: 'active', x: 500, y: 300 }
  ];
  
  generateTopTalkers();
  generateNetworkEvents();
}

function generateTopTalkers() {
  topTalkers = [
    { ip: '192.168.2.10', hostname: 'web-server', bytes: 2.4e9, packets: 1.8e6, protocol: 'HTTP/HTTPS' },
    { ip: '192.168.2.11', hostname: 'db-server', bytes: 1.8e9, packets: 1.2e6, protocol: 'MySQL' },
    { ip: '192.168.3.10', hostname: 'workstation-1', bytes: 850e6, packets: 650000, protocol: 'Mixed' },
    { ip: '192.168.3.11', hostname: 'workstation-2', bytes: 720e6, packets: 520000, protocol: 'Mixed' },
    { ip: '10.0.0.1', hostname: 'border-router', bytes: 3.2e9, packets: 2.1e6, protocol: 'Routing' }
  ];
}

function generateNetworkEvents() {
  const eventTypes = [
    'Device discovered',
    'Link state change',
    'Configuration update',
    'Security event',
    'Performance threshold exceeded',
    'Backup completed',
    'Software update applied'
  ];
  
  networkEvents = [];
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
    networkEvents.push({
      id: i,
      timestamp,
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      device: networkDevices[Math.floor(Math.random() * networkDevices.length)].label,
      description: generateEventDescription(),
      severity: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
    });
  }
  
  networkEvents.sort((a, b) => b.timestamp - a.timestamp);
}

function generateEventDescription() {
  const descriptions = [
    'Interface state changed to up',
    'BGP neighbor established',
    'OSPF adjacency formed',
    'Port security violation detected',
    'CPU utilization above threshold',
    'Memory usage warning triggered',
    'Link redundancy restored',
    'VLAN configuration updated',
    'Firewall rule modified',
    'DNS resolution timeout'
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function initializeTopology() {
  if (document.getElementById('network-topology') && !topologyNetwork) {
    const nodes = new vis.DataSet(networkDevices.map(device => ({
      id: device.id,
      label: device.label,
      color: getDeviceColor(device.type),
      shape: getDeviceShape(device.type),
      size: getDeviceSize(device.type),
      font: { color: '#ffffff', size: 12 }
    })));

    const edges = new vis.DataSet([
      { from: 'router-1', to: 'core-switch-1', color: '#00bcd4', width: 3 },
      { from: 'router-1', to: 'core-switch-2', color: '#00bcd4', width: 3 },
      { from: 'core-switch-1', to: 'core-switch-2', color: '#00bcd4', width: 2 },
      { from: 'core-switch-1', to: 'firewall-1', color: '#f39c12', width: 2 },
      { from: 'core-switch-2', to: 'firewall-1', color: '#f39c12', width: 2 },
      { from: 'core-switch-1', to: 'server-1', color: '#2ecc71', width: 2 },
      { from: 'core-switch-2', to: 'server-2', color: '#2ecc71', width: 2 },
      { from: 'core-switch-1', to: 'switch-1', color: '#3498db', width: 2 },
      { from: 'core-switch-2', to: 'switch-2', color: '#3498db', width: 2 },
      { from: 'switch-1', to: 'endpoint-1', color: '#9b59b6', width: 1 },
      { from: 'switch-1', to: 'endpoint-2', color: '#9b59b6', width: 1 },
      { from: 'switch-2', to: 'endpoint-3', color: '#9b59b6', width: 1 },
      { from: 'switch-2', to: 'endpoint-4', color: '#9b59b6', width: 1 }
    ]);

    const container = document.getElementById('network-topology');
    const data = { nodes, edges };
    const options = {
      layout: {
        hierarchical: {
          enabled: true,
          levelSeparation: 150,
          nodeSpacing: 100,
          treeSpacing: 200,
          blockShifting: true,
          edgeMinimization: true,
          parentCentralization: true,
          direction: 'UD',
          sortMethod: 'directed'
        }
      },
      physics: {
        enabled: false
      },
      interaction: {
        hover: true,
        selectConnectedEdges: false
      },
      nodes: {
        borderWidth: 2,
        borderWidthSelected: 4
      },
      edges: {
        smooth: {
          enabled: true,
          type: 'cubicBezier',
          roundness: 0.4
        }
      }
    };

    topologyNetwork = new vis.Network(container, data, options);
    
    // Add event listeners
    topologyNetwork.on('click', function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        showDeviceDetails(nodeId);
      }
    });

    updateTopologyStats();
  }
}

function getDeviceColor(type) {
  const colors = {
    router: '#e74c3c',
    switch: '#3498db', 
    firewall: '#f39c12',
    server: '#2ecc71',
    endpoint: '#9b59b6'
  };
  return colors[type] || '#95a5a6';
}

function getDeviceShape(type) {
  const shapes = {
    router: 'diamond',
    switch: 'box',
    firewall: 'triangle',
    server: 'ellipse',
    endpoint: 'dot'
  };
  return shapes[type] || 'dot';
}

function getDeviceSize(type) {
  const sizes = {
    router: 30,
    switch: 25,
    firewall: 25,
    server: 20,
    endpoint: 15
  };
  return sizes[type] || 20;
}

function showDeviceDetails(nodeId) {
  const device = networkDevices.find(d => d.id === nodeId);
  if (device) {
    const detailsHtml = `
      <h5 style="color: #4fc3f7; margin-bottom: 10px;">${device.label}</h5>
      <div class="device-info">
        <div><strong>Type:</strong> ${device.type.charAt(0).toUpperCase() + device.type.slice(1)}</div>
        <div><strong>IP Address:</strong> ${device.ip}</div>
        <div><strong>Status:</strong> <span style="color: #2ecc71;">● ${device.status}</span></div>
        <div><strong>Uptime:</strong> ${Math.floor(Math.random() * 30) + 1} days</div>
        <div><strong>CPU:</strong> ${Math.floor(Math.random() * 60) + 10}%</div>
        <div><strong>Memory:</strong> ${Math.floor(Math.random() * 80) + 10}%</div>
        <div><strong>Interfaces:</strong> ${Math.floor(Math.random() * 24) + 4}</div>
      </div>
      <div style="margin-top: 15px;">
        <button onclick="pingDevice('${device.ip}')" style="padding: 5px 10px; font-size: 12px;">Ping</button>
        <button onclick="traceDevice('${device.ip}')" style="padding: 5px 10px; font-size: 12px;">Trace</button>
      </div>
    `;
    document.getElementById('device-details').innerHTML = detailsHtml;
  }
}

function updateTopologyStats() {
  document.getElementById('total-devices').textContent = networkDevices.length;
  document.getElementById('active-links').textContent = networkDevices.length + 3;
  document.getElementById('network-segments').textContent = '4';
  document.getElementById('redundant-paths').textContent = '2';
}

function refreshTopology() {
  // Simulate device discovery
  const newDeviceTypes = ['endpoint', 'server', 'switch'];
  const randomType = newDeviceTypes[Math.floor(Math.random() * newDeviceTypes.length)];
  
  const newDevice = {
    id: `device-${Date.now()}`,
    label: `${randomType.charAt(0).toUpperCase() + randomType.slice(1)} ${networkDevices.length + 1}`,
    type: randomType,
    ip: `192.168.${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 254) + 1}`,
    status: 'active',
    x: Math.random() * 400 - 200,
    y: Math.random() * 400 - 200
  };
  
  networkDevices.push(newDevice);
  updateTopologyStats();
  
  addAlert({
    type: 'info',
    message: `New device discovered: ${newDevice.label} (${newDevice.ip})`,
    timestamp: new Date()
  });
  
  if (topologyNetwork) {
    topologyNetwork.destroy();
    topologyNetwork = null;
    initializeTopology();
  }
}

function autoDiscoverDevices() {
  addAlert({
    type: 'info',
    message: 'Auto-discovery initiated - scanning network segments...',
    timestamp: new Date()
  });
  
  setTimeout(() => {
    const discoveredCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < discoveredCount; i++) {
      setTimeout(() => refreshTopology(), i * 1000);
    }
    
    setTimeout(() => {
      addAlert({
        type: 'info',
        message: `Auto-discovery complete: ${discoveredCount} new devices found`,
        timestamp: new Date()
      });
    }, discoveredCount * 1000 + 500);
  }, 2000);
}

function changeTopologyLayout() {
  const layout = document.getElementById('topology-layout').value;
  if (topologyNetwork) {
    const options = {
      layout: {
        hierarchical: {
          enabled: layout === 'hierarchical'
        }
      },
      physics: {
        enabled: layout === 'force'
      }
    };
    
    topologyNetwork.setOptions(options);
    
    if (layout === 'circular') {
      // Implement circular layout
      const nodes = networkDevices.map((device, index) => {
        const angle = (2 * Math.PI * index) / networkDevices.length;
        const radius = 200;
        return {
          id: device.id,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius
        };
      });
      
      topologyNetwork.setData({ nodes: nodes });
    }
  }
}

function pingDevice(ip) {
  addAlert({
    type: 'info',
    message: `Ping to ${ip}: Reply from ${ip} time=${Math.floor(Math.random() * 50) + 1}ms TTL=64`,
    timestamp: new Date()
  });
}

function traceDevice(ip) {
  addAlert({
    type: 'info',
    message: `Traceroute to ${ip} initiated - 3 hops, avg latency ${Math.floor(Math.random() * 20) + 5}ms`,
    timestamp: new Date()
  });
}

// Advanced Analytics Functions
function initializeAnalytics() {
  initializeAnalyticsCharts();
  updateAnalyticsMetrics();
  generateBandwidthHeatmap();
  updateTopTalkers();
  initializeHealthScore();
  updateNetworkTimeline();
}

function initializeAnalyticsCharts() {
  // Traffic Analytics Chart
  const trafficAnalyticsCtx = document.getElementById('trafficAnalyticsChart')?.getContext('2d');
  if (trafficAnalyticsCtx && !trafficAnalyticsChart) {
    trafficAnalyticsChart = new Chart(trafficAnalyticsCtx, {
      type: 'line',
      data: {
        labels: generateTimeLabels(24),
        datasets: [{
          label: 'Inbound Traffic',
          data: generateTrafficData(24),
          borderColor: '#00bcd4',
          backgroundColor: 'rgba(0, 188, 212, 0.1)',
          fill: true
        }, {
          label: 'Outbound Traffic', 
          data: generateTrafficData(24),
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#fff' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          x: {
            ticks: { color: '#fff' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        },
        plugins: {
          legend: { labels: { color: '#fff' } }
        }
      }
    });
  }

  // Predictive Analytics Chart
  const predictiveCtx = document.getElementById('predictiveChart')?.getContext('2d');
  if (predictiveCtx && !predictiveChart) {
    predictiveChart = new Chart(predictiveCtx, {
      type: 'line',
      data: {
        labels: generateTimeLabels(48, true),
        datasets: [{
          label: 'Historical CPU',
          data: generatePredictiveData(24, false),
          borderColor: '#00bcd4',
          backgroundColor: 'rgba(0, 188, 212, 0.1)',
          borderDash: []
        }, {
          label: 'Predicted CPU',
          data: generatePredictiveData(24, true),
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243, 156, 18, 0.1)',
          borderDash: [5, 5]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: '#fff' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          x: {
            ticks: { color: '#fff' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        },
        plugins: {
          legend: { labels: { color: '#fff' } }
        }
      }
    });
  }
}

function generateTimeLabels(hours, future = false) {
  const labels = [];
  const now = new Date();
  
  for (let i = future ? -hours/2 : -hours; i < (future ? hours/2 : 0); i++) {
    const time = new Date(now.getTime() + (i * 60 * 60 * 1000));
    labels.push(time.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }));
  }
  
  return labels;
}

function generateTrafficData(count) {
  return Array.from({ length: count }, () => Math.random() * 1000 + 100);
}

function generatePredictiveData(count, isPredicted) {
  const baseValue = 40;
  const data = [];
  
  for (let i = 0; i < count; i++) {
    let value = baseValue + Math.sin(i * 0.3) * 20 + Math.random() * 10;
    
    if (isPredicted) {
      // Add some trend for prediction
      value += i * 0.5 + Math.random() * 5;
    }
    
    data.push(Math.max(0, Math.min(100, value)));
  }
  
  return data;
}

function updateAnalyticsMetrics() {
  // Update performance metrics
  document.getElementById('avg-response-time').textContent = `${Math.floor(Math.random() * 50) + 10}ms`;
  document.getElementById('throughput').textContent = `${(Math.random() * 500 + 100).toFixed(1)} Mbps`;
  document.getElementById('packet-loss').textContent = `${(Math.random() * 2).toFixed(2)}%`;
  document.getElementById('jitter').textContent = `${(Math.random() * 10 + 1).toFixed(1)}ms`;
  
  // Update trend indicators
  const trends = ['↗️', '↘️', '↔️'];
  document.getElementById('response-trend').textContent = `${trends[Math.floor(Math.random() * trends.length)]} ${(Math.random() * 10 - 5).toFixed(1)}%`;
  document.getElementById('throughput-trend').textContent = `${trends[Math.floor(Math.random() * trends.length)]} ${(Math.random() * 10 - 5).toFixed(1)}%`;
  document.getElementById('loss-trend').textContent = `${trends[Math.floor(Math.random() * trends.length)]} ${(Math.random() * 2 - 1).toFixed(1)}%`;
  document.getElementById('jitter-trend').textContent = `${trends[Math.floor(Math.random() * trends.length)]} ${(Math.random() * 5 - 2.5).toFixed(1)}%`;
}

function generateBandwidthHeatmap() {
  const heatmapGrid = document.getElementById('heatmap-grid');
  if (heatmapGrid) {
    heatmapGrid.innerHTML = '';
    
    // Generate 7 days × 24 hours heatmap
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        
        // Simulate higher usage during business hours
        let intensity = Math.random();
        if (hour >= 8 && hour <= 18) {
          intensity = Math.random() * 0.4 + 0.6; // 60-100%
        } else if (hour >= 19 && hour <= 23) {
          intensity = Math.random() * 0.5 + 0.3; // 30-80%
        } else {
          intensity = Math.random() * 0.3; // 0-30%
        }
        
        if (intensity > 0.8) cell.classList.add('critical');
        else if (intensity > 0.6) cell.classList.add('high');
        else if (intensity > 0.3) cell.classList.add('medium');
        else cell.classList.add('low');
        
        cell.title = `Day ${day + 1}, Hour ${hour}:00 - ${(intensity * 100).toFixed(1)}% utilization`;
        
        heatmapGrid.appendChild(cell);
      }
    }
  }
}

function updateTopTalkers() {
  const topTalkersContainer = document.getElementById('top-talkers');
  if (topTalkersContainer) {
    topTalkersContainer.innerHTML = topTalkers.map(talker => `
      <div class="top-talker-item">
        <div class="talker-info">
          <div class="talker-ip">${talker.ip}</div>
          <div class="talker-details">${talker.hostname} • ${talker.protocol}</div>
        </div>
        <div class="talker-usage">
          <div>${formatBytes(talker.bytes)}</div>
          <div style="font-size: 11px; opacity: 0.7;">${formatNumber(talker.packets)} packets</div>
        </div>
      </div>
    `).join('');
  }
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatNumber(num) {
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

function initializeHealthScore() {
  const healthCtx = document.getElementById('healthScoreGauge')?.getContext('2d');
  if (healthCtx && !healthScoreGauge) {
    const healthScore = Math.floor(Math.random() * 20) + 80; // 80-100
    
    healthScoreGauge = new Chart(healthCtx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [healthScore, 100 - healthScore],
          backgroundColor: ['#2ecc71', 'rgba(255, 255, 255, 0.1)'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false }
        }
      },
      plugins: [{
        id: 'centerText',
        beforeDraw: function(chart) {
          const ctx = chart.ctx;
          const centerX = chart.width / 2;
          const centerY = chart.height / 2;
          
          ctx.fillStyle = '#2ecc71';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(healthScore + '%', centerX, centerY + 5);
          
          ctx.fillStyle = '#fff';
          ctx.font = '14px Arial';
          ctx.fillText('Health Score', centerX, centerY - 20);
        }
      }]
    });
  }
  
  // Update health metrics
  document.getElementById('availability-score').textContent = `${(Math.random() * 2 + 98).toFixed(1)}%`;
  document.getElementById('performance-score').textContent = `${(Math.random() * 10 + 90).toFixed(1)}%`;
  document.getElementById('security-score').textContent = `${(Math.random() * 5 + 95).toFixed(1)}%`;
}

function updateNetworkTimeline() {
  const timeline = document.getElementById('network-timeline');
  if (timeline) {
    timeline.innerHTML = networkEvents.slice(0, 15).map(event => `
      <div class="timeline-event">
        <div class="timeline-event-time">${event.timestamp.toLocaleString()}</div>
        <div class="timeline-event-title">${event.type} - ${event.device}</div>
        <div class="timeline-event-description">${event.description}</div>
      </div>
    `).join('');
  }
}

function updateAnalyticsTimeframe() {
  const timeframe = document.getElementById('analytics-timeframe').value;
  
  addAlert({
    type: 'info',
    message: `Analytics timeframe updated to: ${timeframe}`,
    timestamp: new Date()
  });
  
  // Regenerate charts with new timeframe
  if (trafficAnalyticsChart) {
    const hours = timeframe === '1h' ? 1 : timeframe === '6h' ? 6 : timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720;
    trafficAnalyticsChart.data.labels = generateTimeLabels(hours);
    trafficAnalyticsChart.data.datasets[0].data = generateTrafficData(hours);
    trafficAnalyticsChart.data.datasets[1].data = generateTrafficData(hours);
    trafficAnalyticsChart.update();
  }
}

function generateAnalyticsReport() {
  addAlert({
    type: 'info',
    message: 'Generating comprehensive analytics report...',
    timestamp: new Date()
  });
  
  setTimeout(() => {
    addAlert({
      type: 'info',
      message: 'Analytics report generated - 47 metrics analyzed, 3 recommendations identified',
      timestamp: new Date()
    });
  }, 2000);
}

function predictNetworkTrends() {
  addAlert({
    type: 'info',
    message: 'AI trend prediction initiated - analyzing 30 days of historical data...',
    timestamp: new Date()
  });
  
  setTimeout(() => {
    const predictions = [
      'CPU utilization expected to increase 12% over next 7 days',
      'Bandwidth usage trending upward, may require upgrade in Q2',
      'No critical incidents predicted in next 48 hours',
      'Memory usage stable, within normal parameters'
    ];
    
    predictions.forEach((prediction, index) => {
      setTimeout(() => {
        addAlert({
          type: 'info',
          message: `Prediction ${index + 1}: ${prediction}`,
          timestamp: new Date()
        });
      }, (index + 1) * 1000);
    });
  }, 3000);
}

// Real-time Monitoring Functions
function startRealTimeMonitoring() {
  monitoringActive = true;
  updateRealTimeData();
  
  monitoringTimer = setInterval(() => {
    if (monitoringActive) {
      updateRealTimeData();
      
      // Update analytics if on analytics tab
      if (currentTab === 'analytics') {
        updateAnalyticsMetrics();
      }
    }
  }, refreshInterval);
}

function updateRealTimeData() {
  const newData = generateNetworkData();
  updateNetworkMetrics(newData);
  updateCharts(newData);
  analyzeForIncidents(newData);
  
  // Simulate network topology changes
  if (Math.random() < 0.02) { // 2% chance
    simulateTopologyChange();
  }
}

function generateNetworkData() {
  const timestamp = new Date().toLocaleTimeString();
  const timeOfDay = new Date().getHours();
  
  // Simulate realistic network patterns based on time
  const trafficMultiplier = timeOfDay >= 9 && timeOfDay <= 17 ? 1.5 : 0.8;
  
  return {
    timestamp,
    connections: Math.floor(Math.random() * 150 * trafficMultiplier) + 50,
    latency: Math.floor(Math.random() * 50) + 10 + (Math.random() < 0.1 ? Math.random() * 100 : 0),
    inTraffic: (Math.random() * 100 + 20) * trafficMultiplier,
    outTraffic: (Math.random() * 80 + 15) * trafficMultiplier,
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk: Math.random() * 100,
    packetLoss: Math.random() * 5,
    bandwidth: Math.random() * 1000 + 100,
    jitter: Math.random() * 10,
    throughput: Math.random() * 500 + 100
  };
}

function simulateTopologyChange() {
  const changes = [
    'New device detected on network segment',
    'Router failover detected - secondary path active',
    'Switch port state changed to forwarding',
    'VLAN configuration updated on core switches',
    'Network route convergence completed',
    'Redundant link restored on core network'
  ];
  
  addAlert({
    type: 'info',
    message: changes[Math.floor(Math.random() * changes.length)],
    timestamp: new Date()
  });
}

function updateNetworkMetrics(data) {
  document.getElementById("active-connections").textContent = data.connections;
  document.getElementById("avg-latency").textContent = `${data.latency} ms`;
  
  // Enhanced status determination
  let status = "🟢 Healthy";
  let statusClass = "healthy";
  
  if (data.latency > 100 || data.packetLoss > 2 || data.cpu > 80) {
    status = "🟡 Warning";
    statusClass = "warning";
  }
  if (data.latency > 200 || data.packetLoss > 5 || data.cpu > 90 || data.memory > 95) {
    status = "🔴 Critical";
    statusClass = "critical";
  }
  
  const statusElement = document.getElementById("network-status");
  statusElement.textContent = status;
  statusElement.className = `status-value ${statusClass}`;
  
  document.getElementById("alert-count").textContent = alertsHistory.length;
  
  // Store data
  networkData = { ...networkData, ...data };
}

function updateCharts(data) {
  // Update traffic chart
  if (trafficChart && trafficChart.data) {
    if (trafficChart.data.labels.length > 20) {
      trafficChart.data.labels.shift();
      trafficChart.data.datasets[0].data.shift();
      trafficChart.data.datasets[1].data.shift();
    }
    
    trafficChart.data.labels.push(data.timestamp.split(' ')[1] || data.timestamp);
    trafficChart.data.datasets[0].data.push(data.inTraffic.toFixed(1));
    trafficChart.data.datasets[1].data.push(data.outTraffic.toFixed(1));
    trafficChart.update('none');
  }
  
  // Update resource chart
  if (resourceChart && resourceChart.data) {
    resourceChart.data.datasets[0].data = [
      Math.round(data.cpu),
      Math.round(data.memory),
      Math.round(data.disk)
    ];
    resourceChart.update('none');
  }
}

// Enhanced AI-Powered Log Analysis
async function analyzeLogAI() {
  const logInput = document.getElementById("log-input").value.trim();
  if (!logInput) {
    document.getElementById("analysis-output").innerHTML = `
      <div style="text-align: center; opacity: 0.7;">
        📝 Please enter network logs to analyze
        <br><small>Try pasting logs containing keywords like: BGP, OSPF, err-disabled, CPU, Memory, Authentication</small>
      </div>
    `;
    return;
  }
  
  document.getElementById("analysis-output").innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px; justify-content: center;">
      <div class="loading"></div>
      <div>
        <div>🤖 AI is analyzing your network logs...</div>
        <small style="opacity: 0.7;">Processing ${logInput.split('\n').length} lines of log data</small>
      </div>
    </div>
  `;
  
  try {
    const analysis = await simulateAIAnalysis(logInput);
    displayAnalysisResult(analysis, 'AI');
    updateNetworkCommandSuggestions(analysis.detectedIssues);
  } catch (error) {
    document.getElementById("analysis-output").innerHTML = `
      <div style="color: #ff5252; text-align: center;">
        ❌ AI Analysis Error: ${error.message}
        <br>Falling back to pattern analysis...
      </div>
    `;
    
    setTimeout(() => analyzeLogPattern(), 1000);
  }
}

async function simulateAIAnalysis(logText) {
  // Simulate realistic API delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
  
  const insights = [];
  const detectedIssues = [];
  const troubleshootingSteps = [];
  const physicalChecks = [];
  const preventiveMeasures = [];
  let severity = "info";
  
  // Enhanced pattern detection with detailed troubleshooting
  const patterns = {
    'err-disabled': {
      severity: 'critical',
      description: 'Port security violation or BPDU guard triggered',
      rootCause: 'Unauthorized device connection, spanning tree loop, or port flapping',
      immediateAction: 'Isolate affected port and investigate connected device',
      physicalChecks: [
        '🔌 Check cable connections on affected port',
        '🖥️ Verify connected device MAC address and authorization',
        '📡 Test cable integrity with cable tester',
        '🔄 Check for loose connections or damaged RJ45 connectors',
        '⚡ Verify power levels on connected device'
      ],
      commands: [
        { cmd: 'show interfaces status err-disabled', desc: 'List all err-disabled ports' },
        { cmd: 'show errdisable recovery', desc: 'Check auto-recovery settings' },
        { cmd: 'show port-security interface [interface]', desc: 'Check port security violations' },
        { cmd: 'show spanning-tree interface [interface] detail', desc: 'Verify spanning tree state' },
        { cmd: 'show mac address-table interface [interface]', desc: 'Check learned MAC addresses' }
      ],
      stepByStep: [
        '1. 🚨 IMMEDIATE: Disconnect unauthorized device if found',
        '2. 🔍 Run diagnostic commands to identify root cause',
        '3. 🔧 Clear error state: "errdisable recovery cause all"',
        '4. 🔌 Physically inspect cable and connections',
        '5. ✅ Re-enable port: "no shutdown" after issue resolved',
        '6. 📊 Monitor for 30 minutes to ensure stability'
      ],
      prevention: [
        'Configure port security with sticky MAC learning',
        'Set up proper BPDU guard on access ports',
        'Implement regular cable testing schedule',
        'Use quality certified cables and connectors'
      ]
    },
    'bgp': {
      severity: 'critical',
      description: 'BGP neighbor relationships failing or routes missing',
      rootCause: 'Network connectivity issues, configuration mismatch, or routing loops',
      immediateAction: 'Verify BGP neighbor connectivity and route advertisements',
      physicalChecks: [
        '🌐 Test WAN link connectivity to BGP peers',
        '📡 Check router interface LEDs and status',
        '🔌 Verify WAN cable connections and fiber optics',
        '⚡ Check power supply and temperature on border routers',
        '📶 Test signal strength on wireless WAN links'
      ],
      commands: [
        { cmd: 'show ip bgp summary', desc: 'Check all BGP neighbor states' },
        { cmd: 'show ip bgp neighbors [neighbor-ip]', desc: 'Detailed neighbor information' },
        { cmd: 'show ip route bgp', desc: 'Verify BGP routes in routing table' },
        { cmd: 'ping [neighbor-ip] source [local-ip]', desc: 'Test connectivity to BGP peer' },
        { cmd: 'traceroute [neighbor-ip]', desc: 'Trace path to BGP neighbor' }
      ],
      stepByStep: [
        '1. 🚨 IMMEDIATE: Check if neighbor is reachable via ping',
        '2. 🔍 Verify BGP neighbor configuration matches peer',
        '3. 🔧 Check AS numbers, router IDs, and authentication',
        '4. 🌐 Test physical connectivity to peer networks',
        '5. ✅ Reset BGP session if configuration is correct',
        '6. 📊 Monitor route convergence and stability'
      ],
      prevention: [
        'Implement BGP monitoring with automated alerts',
        'Configure backup BGP peers for redundancy',
        'Regular testing of WAN link failover',
        'Document BGP policies and route maps'
      ]
    },
    'ospf': {
      severity: 'warning',
      description: 'OSPF neighbor adjacencies unstable or missing routes',
      rootCause: 'Hello/dead timer mismatch, area configuration errors, or network MTU issues',
      immediateAction: 'Synchronize OSPF parameters across all neighbors',
      physicalChecks: [
        '🔌 Check all LAN cable connections between OSPF routers',
        '📡 Verify switch ports connecting OSPF neighbors',
        '⚡ Check power and status LEDs on all OSPF routers',
        '🌡️ Monitor temperature and ventilation on network equipment',
        '🔄 Test link aggregation if configured between neighbors'
      ],
      commands: [
        { cmd: 'show ip ospf neighbor', desc: 'Check OSPF neighbor states' },
        { cmd: 'show ip ospf interface', desc: 'Verify OSPF interface configuration' },
        { cmd: 'show ip ospf database', desc: 'Check OSPF topology database' },
        { cmd: 'show ip ospf border-routers', desc: 'Verify ABR and ASBR connectivity' },
        { cmd: 'debug ip ospf adj', desc: 'Debug adjacency formation (use carefully)' }
      ],
      stepByStep: [
        '1. 🔍 Compare OSPF hello/dead timers on all neighbors',
        '2. 🔧 Verify area numbers match on connected interfaces',
        '3. 🌐 Check network types (broadcast/point-to-point) consistency',
        '4. 📊 Test MTU sizes between OSPF neighbors',
        '5. ✅ Clear OSPF process if needed: "clear ip ospf process"',
        '6. 🕐 Monitor adjacency stability for 1 hour'
      ],
      prevention: [
        'Standardize OSPF timers across the network',
        'Document OSPF area designs and ABR placement',
        'Implement OSPF authentication for security',
        'Regular OSPF database consistency checks'
      ]
    },
    'cpu': {
      severity: 'critical',
      description: 'High CPU utilization affecting device performance',
      rootCause: 'Process overload, routing loops, or hardware failure',
      immediateAction: 'Identify resource-intensive processes immediately',
      physicalChecks: [
        '🌡️ Check device temperature and cooling fans',
        '⚡ Verify power supply voltage and current draw',
        '💾 Check memory modules for proper seating',
        '🔌 Inspect all cable connections for excessive traffic',
        '📱 Check for physical damage or overheating signs'
      ],
      commands: [
        { cmd: 'show processes cpu sorted', desc: 'Identify high CPU processes' },
        { cmd: 'show processes cpu history', desc: 'View CPU usage trends' },
        { cmd: 'show memory summary', desc: 'Check available memory' },
        { cmd: 'show interfaces | include rate', desc: 'Check interface utilization' },
        { cmd: 'show logging | include %CPU', desc: 'Search for CPU-related errors' }
      ],
      stepByStep: [
        '1. 🚨 IMMEDIATE: Identify top CPU consuming process',
        '2. 🔍 Determine if process is legitimate or malicious',
        '3. 🔧 Stop non-essential services temporarily',
        '4. 🌡️ Check hardware temperature and cooling',
        '5. 📊 Implement traffic shaping if caused by floods',
        '6. ⚠️ Consider failover to backup device if critical'
      ],
      prevention: [
        'Implement CPU threshold monitoring and alerting',
        'Regular capacity planning and hardware upgrades',
        'Configure rate limiting for control plane protection',
        'Scheduled maintenance during low-traffic periods'
      ]
    },
    'memory': {
      severity: 'warning',
      description: 'Memory utilization above safe operating threshold',
      rootCause: 'Memory leak, large routing tables, or insufficient RAM',
      immediateAction: 'Free up memory by clearing unnecessary data',
      physicalChecks: [
        '💾 Physically inspect RAM modules and seating',
        '🔧 Check for loose memory module connections',
        '⚡ Verify proper voltage to memory subsystem',
        '🌡️ Monitor memory module temperatures',
        '📊 Test memory modules individually if possible'
      ],
      commands: [
        { cmd: 'show memory summary', desc: 'View memory usage breakdown' },
        { cmd: 'show processes memory sorted', desc: 'Find memory-intensive processes' },
        { cmd: 'show memory heap summary', desc: 'Check heap memory allocation' },
        { cmd: 'show buffers', desc: 'View buffer usage statistics' },
        { cmd: 'clear counters', desc: 'Clear interface counters (frees some memory)' }
      ],
      stepByStep: [
        '1. 🔍 Identify which process is consuming most memory',
        '2. 🧹 Clear unnecessary caches and temporary data',
        '3. 📊 Reduce routing table size if possible',
        '4. 🔧 Restart memory-intensive processes if needed',
        '5. 💾 Consider memory upgrade if consistently high',
        '6. 📈 Monitor memory trends for 24 hours'
      ],
      prevention: [
        'Set up memory utilization monitoring and alerts',
        'Regular memory usage trend analysis',
        'Implement memory leak detection procedures',
        'Plan memory upgrades before reaching 80% utilization'
      ]
    },
    'authentication': {
      severity: 'critical',
      description: 'Authentication failures - potential security breach',
      rootCause: 'Brute force attack, credential compromise, or AAA server issues',
      immediateAction: 'Secure the network and investigate unauthorized access',
      physicalChecks: [
        '🔒 Check for unauthorized physical access to equipment',
        '📱 Verify console cable connections and security',
        '🖥️ Inspect workstations for malware or keyloggers',
        '📡 Check wireless access points for rogue devices',
        '🔌 Secure all physical network connections'
      ],
      commands: [
        { cmd: 'show aaa sessions', desc: 'View active authentication sessions' },
        { cmd: 'show authentication sessions', desc: 'Check 802.1X authentication status' },
        { cmd: 'show logging | include Authentication', desc: 'Review authentication logs' },
        { cmd: 'show users', desc: 'List currently logged in users' },
        { cmd: 'show tacacs', desc: 'Check TACACS+ server connectivity' }
      ],
      stepByStep: [
        '1. 🚨 IMMEDIATE: Block suspicious IP addresses',
        '2. 🔒 Change all administrative passwords',
        '3. 🔍 Review logs for compromise timeline',
        '4. 🛡️ Enable account lockout policies',
        '5. 📊 Implement additional authentication factors',
        '6. 🕵️ Conduct full security audit'
      ],
      prevention: [
        'Implement multi-factor authentication (MFA)',
        'Use strong password policies and rotation',
        'Set up real-time authentication monitoring',
        'Regular security assessments and penetration testing'
      ]
    },
    'interface': {
      severity: 'warning',
      description: 'Interface errors or performance degradation detected',
      rootCause: 'Cable issues, duplex mismatch, or port hardware failure',
      immediateAction: 'Test cable integrity and interface configuration',
      physicalChecks: [
        '🔌 Test cable with cable tester for opens/shorts',
        '📏 Verify cable length within specification limits',
        '🔄 Check RJ45 connector crimping and pin alignment',
        '⚡ Test Power over Ethernet (PoE) if applicable',
        '📡 Inspect fiber optic connectors for cleanliness'
      ],
      commands: [
        { cmd: 'show interfaces [interface]', desc: 'Detailed interface statistics' },
        { cmd: 'show interfaces description', desc: 'View interface descriptions' },
        { cmd: 'show interfaces counters errors', desc: 'Check error counters' },
        { cmd: 'show interfaces status', desc: 'View interface operational status' },
        { cmd: 'test cable-diagnostics tdr interface [interface]', desc: 'Run cable diagnostics' }
      ],
      stepByStep: [
        '1. 🔍 Check interface error counters and rates',
        '2. 🔧 Verify speed/duplex settings match on both ends',
        '3. 🔌 Physically test cable with cable tester',
        '4. 🔄 Try different cable or port if available',
        '5. 📊 Reset interface counters and monitor',
        '6. ✅ Replace cable/hardware if issues persist'
      ],
      prevention: [
        'Use quality certified cables for all connections',
        'Implement regular cable testing schedule',
        'Document all cable runs and test results',
        'Maintain spare cables and connectors inventory'
      ]
    }
  };
  
  // Analyze log content with enhanced detection
  for (const [keyword, info] of Object.entries(patterns)) {
    if (logText.toLowerCase().includes(keyword.toLowerCase())) {
      insights.push({
        type: info.severity,
        message: `${keyword.toUpperCase()} Issue: ${info.description}`,
        details: `Root Cause: ${info.rootCause}\n\nImmediate Action Required: ${info.immediateAction}`,
        commands: info.commands,
        physicalChecks: info.physicalChecks,
        stepByStep: info.stepByStep,
        prevention: info.prevention
      });
      
      detectedIssues.push(keyword);
      
      if (info.severity === 'critical' && severity !== 'critical') {
        severity = 'critical';
      } else if (info.severity === 'warning' && severity === 'info') {
        severity = 'warning';
      }
    }
  }
  
  // Add contextual analysis
  const timestamp = new Date().toISOString();
  const wordCount = logText.split(' ').length;
  const lineCount = logText.split('\n').length;
  const confidence = Math.random() * 30 + 70; // 70-100%
  
  return {
    timestamp,
    severity,
    summary: insights.length > 0 ? 
      `Identified ${insights.length} network issues with detailed troubleshooting steps` : 
      "No critical issues detected - network appears stable",
    insights,
    detectedIssues,
    metadata: {
      logSize: `${wordCount} words, ${lineCount} lines`,
      analysisType: 'AI-Enhanced Point-to-Point Diagnosis',
      confidence: confidence,
      processingTime: `${(2000 + Math.random() * 2000).toFixed(0)}ms`,
      modelVersion: 'NetworkAI Pro v3.0 - Enterprise Troubleshooting Edition'
    }
  };
}

function updateNetworkCommandSuggestions(issues = []) {
  let commandsHtml = '<h4 style="color: #4fc3f7; margin-bottom: 15px;">📋 Suggested Network Commands</h4>';
  
  if (issues.length > 0) {
    issues.forEach(issue => {
      if (networkCommands[issue]) {
        commandsHtml += `
          <div style="margin-bottom: 20px; padding: 15px; background: rgba(0, 188, 212, 0.1); border-radius: 10px; border-left: 4px solid #00bcd4;">
            <strong style="color: #4fc3f7;">${issue.toUpperCase()} Commands:</strong>
            <div style="margin-top: 10px;">
              ${networkCommands[issue].map(cmd => 
                `<div style="font-family: 'JetBrains Mono', monospace; background: rgba(0, 0, 0, 0.3); padding: 8px; margin: 5px 0; border-radius: 5px; cursor: pointer;" 
                 onclick="copyToClipboard('${cmd}')">
                  <code>${cmd}</code>
                  <span style="float: right; opacity: 0.7;">📋 Click to copy</span>
                </div>`
              ).join('')}
            </div>
          </div>
        `;
      }
    });
  } else {
    // Show general commands
    commandsHtml += `
      <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 10px; border-left: 4px solid #4caf50;">
        <strong style="color: #4caf50;">General Network Commands:</strong>
        <div style="margin-top: 10px;">
          ${networkCommands['general'].slice(0, 8).map(cmd => 
            `<div style="font-family: 'JetBrains Mono', monospace; background: rgba(0, 0, 0, 0.3); padding: 8px; margin: 5px 0; border-radius: 5px; cursor: pointer;" 
             onclick="copyToClipboard('${cmd}')">
              <code>${cmd}</code>
              <span style="float: right; opacity: 0.7;">📋 Click to copy</span>
            </div>`
          ).join('')}
        </div>
      </div>
    `;
  }
  
  // Add command suggestions to analysis output if it exists
  const analysisOutput = document.getElementById("analysis-output");
  if (analysisOutput && analysisOutput.innerHTML.includes('Analysis Results')) {
    analysisOutput.innerHTML += `<div style="margin-top: 25px; border-top: 2px solid rgba(0, 188, 212, 0.3); padding-top: 20px;">${commandsHtml}</div>`;
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    addAlert({
      type: 'info',
      message: `Command copied: ${text}`,
      timestamp: new Date()
    });
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    addAlert({
      type: 'info',
      message: `Command copied: ${text}`,
      timestamp: new Date()
    });
  });
}

// ... (rest of the existing functions from previous version)

function analyzeLogPattern() {
  const logInput = document.getElementById("log-input").value.trim();
  if (!logInput) {
    document.getElementById("analysis-output").textContent = "Please enter log data to analyze.";
    return;
  }
  
  const analysis = performPatternAnalysis(logInput);
  displayAnalysisResult(analysis, 'Pattern');
  updateNetworkCommandSuggestions(analysis.detectedIssues);
}

function performPatternAnalysis(logText) {
  const insights = [];
  const detectedIssues = [];
  const keywords = logText.toLowerCase();
  
  // Enhanced pattern matching
  const patterns = [
    { key: 'err-disabled', regex: /err-?disabled/i, type: 'critical', issue: 'err-disabled' },
    { key: 'ospf', regex: /ospf/i, type: 'warning', issue: 'ospf' },
    { key: 'bgp', regex: /bgp/i, type: 'warning', issue: 'bgp' },
    { key: 'cpu', regex: /cpu|processor/i, type: 'critical', issue: 'cpu' },
    { key: 'memory', regex: /memory|mem/i, type: 'warning', issue: 'memory' },
    { key: 'authentication', regex: /auth|login|credential/i, type: 'critical', issue: 'authentication' }
  ];
  
  patterns.forEach(pattern => {
    if (pattern.regex.test(logText)) {
      const messages = {
        'err-disabled': "Interface err-disabled state detected",
        'ospf': "OSPF routing protocol anomaly",
        'bgp': "BGP protocol irregularities detected",
        'cpu': "Resource utilization threshold exceeded",
        'memory': "Memory usage above threshold",
        'authentication': "Authentication issues detected"
      };
      
      const details = {
        'err-disabled': "Possible causes: BPDU Guard violation, port security breach\nActions: Check errdisable recovery, investigate connected devices",
        'ospf': "Possible causes: Neighbor relationship issues, area misconfig\nActions: Verify OSPF adjacencies and area settings",
        'bgp': "Possible causes: Peer unreachable, route filtering issues\nActions: Check BGP sessions and route advertisements",
        'cpu': "High system resource usage detected\nActions: Monitor processes, consider capacity planning",
        'memory': "Memory usage above threshold detected\nActions: Monitor memory allocation, check for leaks",
        'authentication': "Authentication failures detected\nActions: Review access policies, check credentials"
      };
      
      insights.push({
        type: pattern.type,
        message: messages[pattern.key],
        details: details[pattern.key]
      });
      
      detectedIssues.push(pattern.issue);
    }
  });
  
  return {
    timestamp: new Date().toISOString(),
    severity: insights.some(i => i.type === 'critical') ? 'critical' : 
             insights.some(i => i.type === 'warning') ? 'warning' : 'info',
    summary: insights.length > 0 ? 
      `Identified ${insights.length} network issues` : 
      "No recognized patterns found",
    insights,
    detectedIssues,
    metadata: {
      analysisType: 'Traditional Pattern Matching',
      logSize: `${logText.length} characters`
    }
  };
}

function displayAnalysisResult(analysis, type) {
  const output = document.getElementById("analysis-output");
  
  let resultHtml = `
    <div style="border-bottom: 2px solid rgba(0,188,212,0.4); padding-bottom: 15px; margin-bottom: 20px;">
      <h4 style="margin: 0; color: #4fc3f7; font-size: 1.4em;">🔬 ${type} Analysis Results</h4>
      <div style="display: flex; justify-content: space-between; margin-top: 8px;">
        <small style="opacity: 0.8;">Analysis completed: ${new Date(analysis.timestamp).toLocaleString()}</small>
        ${analysis.metadata?.confidence ? `<small style="opacity: 0.8;">Confidence: ${Math.round(analysis.metadata.confidence)}%</small>` : ''}
      </div>
    </div>
    
    <div style="margin-bottom: 25px; padding: 15px; background: rgba(0, 0, 0, 0.3); border-radius: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <strong style="font-size: 1.1em;">Executive Summary:</strong>
        <span style="padding: 4px 12px; border-radius: 20px; font-size: 0.9em; font-weight: 600; color: ${getSeverityColor(analysis.severity)}; border: 1px solid ${getSeverityColor(analysis.severity)};">
          ${analysis.severity.toUpperCase()}
        </span>
      </div>
      <div style="opacity: 0.9;">${analysis.summary}</div>
    </div>
  `;
  
  if (analysis.insights.length > 0) {
    resultHtml += `<div style="margin-bottom: 25px;"><strong style="font-size: 1.2em; color: #4fc3f7;">🚨 Detailed Issue Analysis & Troubleshooting</strong></div>`;
    
    analysis.insights.forEach((insight, index) => {
      resultHtml += `
        <div style="margin: 25px 0; padding: 25px; border-left: 4px solid ${getSeverityColor(insight.type)}; 
                    background: linear-gradient(90deg, ${getSeverityColor(insight.type)}15, transparent); 
                    border-radius: 0 15px 15px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          
          <!-- Issue Header -->
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <span style="font-size: 1.5em; margin-right: 10px;">${insight.type === 'critical' ? '🚨' : insight.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <strong style="font-size: 1.2em; color: ${getSeverityColor(insight.type)};">${insight.message}</strong>
          </div>
          
          <!-- Root Cause & Immediate Action -->
          <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="font-size: 0.95em; opacity: 0.9; white-space: pre-line;">${insight.details}</div>
          </div>

          ${insight.physicalChecks ? `
          <!-- Physical Checks Section -->
          <div style="margin-bottom: 20px;">
            <h5 style="color: #ff9800; margin-bottom: 10px; font-size: 1.1em;">🔧 Physical Inspection Checklist:</h5>
            <div style="background: rgba(255, 152, 0, 0.1); padding: 15px; border-radius: 8px; border-left: 3px solid #ff9800;">
              ${insight.physicalChecks.map(check => `
                <div style="margin: 8px 0; padding: 5px 0; border-bottom: 1px solid rgba(255,152,0,0.2);">
                  <label style="cursor: pointer; display: flex; align-items: center;">
                    <input type="checkbox" style="margin-right: 10px; transform: scale(1.2);">
                    <span style="font-size: 14px;">${check}</span>
                  </label>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${insight.stepByStep ? `
          <!-- Step-by-Step Troubleshooting -->
          <div style="margin-bottom: 20px;">
            <h5 style="color: #4caf50; margin-bottom: 10px; font-size: 1.1em;">📋 Step-by-Step Troubleshooting:</h5>
            <div style="background: rgba(76, 175, 80, 0.1); padding: 15px; border-radius: 8px; border-left: 3px solid #4caf50;">
              ${insight.stepByStep.map((step, stepIndex) => `
                <div style="margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px;">
                  <div style="font-weight: bold; color: #4caf50; margin-bottom: 5px;">${step}</div>
                  ${stepIndex < insight.stepByStep.length - 1 ? '<div style="height: 1px; background: rgba(76,175,80,0.3); margin-top: 10px;"></div>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${insight.commands ? `
          <!-- Network Commands -->
          <div style="margin-bottom: 20px;">
            <h5 style="color: #2196f3; margin-bottom: 10px; font-size: 1.1em;">💻 Diagnostic Commands:</h5>
            <div style="background: rgba(33, 150, 243, 0.1); padding: 15px; border-radius: 8px; border-left: 3px solid #2196f3;">
              ${insight.commands.map(cmdInfo => `
                <div style="margin: 8px 0; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <code style="font-family: 'JetBrains Mono', monospace; color: #4fc3f7; font-size: 13px;">${cmdInfo.cmd}</code>
                    <button onclick="copyToClipboard('${cmdInfo.cmd}')" style="padding: 4px 8px; font-size: 11px; background: rgba(79,195,247,0.2); border: 1px solid #4fc3f7; border-radius: 4px; color: #4fc3f7; cursor: pointer;">📋 Copy</button>
                  </div>
                  <div style="font-size: 12px; opacity: 0.8; margin-top: 5px; color: #b0bec5;">${cmdInfo.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          ${insight.prevention ? `
          <!-- Prevention Measures -->
          <div style="margin-bottom: 15px;">
            <h5 style="color: #9c27b0; margin-bottom: 10px; font-size: 1.1em;">🛡️ Prevention & Best Practices:</h5>
            <div style="background: rgba(156, 39, 176, 0.1); padding: 15px; border-radius: 8px; border-left: 3px solid #9c27b0;">
              ${insight.prevention.map(measure => `
                <div style="margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                  <span style="margin-right: 8px;">🔹</span>
                  <span style="font-size: 14px;">${measure}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

        </div>
      `;
    });
  }
  
  if (analysis.metadata) {
    resultHtml += `
      <div style="margin-top: 30px; padding: 20px; border-top: 2px solid rgba(0,188,212,0.3); background: rgba(0,0,0,0.2); border-radius: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <strong style="color: #4fc3f7; font-size: 1.1em;">📊 Analysis Metadata</strong>
          <span style="opacity: 0.7; font-size: 0.9em;">Powered by ${analysis.metadata.modelVersion}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px;">
            <strong style="color: #4fc3f7;">Analysis Type:</strong><br>
            <span style="font-size: 0.9em;">${analysis.metadata.analysisType}</span>
          </div>
          ${analysis.metadata.logSize ? `
          <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px;">
            <strong style="color: #4fc3f7;">Log Size:</strong><br>
            <span style="font-size: 0.9em;">${analysis.metadata.logSize}</span>
          </div>
          ` : ''}
          ${analysis.metadata.confidence ? `
          <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px;">
            <strong style="color: #4fc3f7;">Confidence:</strong><br>
            <span style="font-size: 0.9em;">${Math.round(analysis.metadata.confidence)}%</span>
          </div>
          ` : ''}
          ${analysis.metadata.processingTime ? `
          <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px;">
            <strong style="color: #4fc3f7;">Processing Time:</strong><br>
            <span style="font-size: 0.9em;">${analysis.metadata.processingTime}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  output.innerHTML = resultHtml;
  
  // Add command suggestions
  setTimeout(() => updateNetworkCommandSuggestions(analysis.detectedIssues), 100);
}

function getSeverityColor(severity) {
  switch(severity) {
    case 'critical': return '#e74c3c';
    case 'warning': return '#f39c12';
    case 'info': return '#3498db';
    default: return '#00bcd4';
  }
}

// Incident Detection and Alerting
function analyzeForIncidents(data) {
  const alerts = [];
  
  if (data.latency > 150) {
    alerts.push({
      type: 'warning',
      message: `High latency detected: ${data.latency}ms (threshold: 150ms)`,
      timestamp: new Date()
    });
  }
  
  if (data.cpu > 85) {
    alerts.push({
      type: 'critical',
      message: `Critical CPU usage: ${Math.round(data.cpu)}% (threshold: 85%)`,
      timestamp: new Date()
    });
  }
  
  if (data.memory > 90) {
    alerts.push({
      type: 'critical',
      message: `Critical memory usage: ${Math.round(data.memory)}% (threshold: 90%)`,
      timestamp: new Date()
    });
  }
  
  if (data.packetLoss > 3) {
    alerts.push({
      type: 'warning',
      message: `Packet loss detected: ${data.packetLoss.toFixed(2)}% (threshold: 3%)`,
      timestamp: new Date()
    });
  }
  
  if (data.jitter > 8) {
    alerts.push({
      type: 'warning',
      message: `High network jitter: ${data.jitter.toFixed(1)}ms (threshold: 8ms)`,
      timestamp: new Date()
    });
  }
  
  alerts.forEach(alert => addAlert(alert));
}

function addAlert(alert) {
  alertsHistory.unshift(alert);
  
  // Keep only last 100 alerts
  if (alertsHistory.length > 100) {
    alertsHistory = alertsHistory.slice(0, 100);
  }
  
  updateAlertsDisplay();
}

function updateAlertsDisplay() {
  const alertsFeed = document.getElementById("alerts-feed");
  
  if (alertsHistory.length === 0) {
    alertsFeed.innerHTML = `
      <div style="text-align: center; opacity: 0.6; padding: 20px;">
        <div style="font-size: 2em; margin-bottom: 10px;">🟢</div>
        <div>All systems operational</div>
        <small>No alerts at this time</small>
      </div>
    `;
    return;
  }
  
  const alertsHtml = alertsHistory.slice(0, 15).map((alert, index) => {
    // Don't add diagnostic button to info alerts or diagnostic alerts themselves
    const needsDiagnostic = (alert.type === 'critical' || alert.type === 'warning') && 
                           !alert.message.includes('Quick Diagnostic') && 
                           !alert.message.includes('Step ') &&
                           !alert.message.includes('Log Context');
    
    return `
      <div class="alert-item ${alert.type}" style="animation: slideIn 0.5s ease ${index * 0.1}s both;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1; margin-right: 10px;">
            <strong>[${alert.timestamp.toLocaleTimeString()}]</strong> 
            <span>${alert.message}</span>
            ${alert.details ? `<div style="font-size: 12px; opacity: 0.8; margin-top: 5px; color: #b0bec5;">${alert.details}</div>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="opacity: 0.7; font-size: 0.8em;">
              ${alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            ${needsDiagnostic ? `
              <button onclick="quickDiagnostic('${alert.message.replace(/'/g, '&#39;')}')" 
                      style="padding: 4px 8px; font-size: 11px; background: rgba(79,195,247,0.3); 
                             border: 1px solid #4fc3f7; border-radius: 4px; color: #4fc3f7; 
                             cursor: pointer; transition: all 0.3s ease;" 
                      onmouseover="this.style.background='rgba(79,195,247,0.5)'"
                      onmouseout="this.style.background='rgba(79,195,247,0.3)'">
                🔬 Quick Diagnostic
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  alertsFeed.innerHTML = alertsHtml;
}

// Control Functions
function toggleAutoMonitoring() {
  monitoringActive = document.getElementById("auto-monitor").checked;
  
  if (monitoringActive && !monitoringTimer) {
    startRealTimeMonitoring();
    addAlert({
      type: 'info',
      message: 'Auto-monitoring enabled',
      timestamp: new Date()
    });
  } else if (!monitoringActive && monitoringTimer) {
    clearInterval(monitoringTimer);
    monitoringTimer = null;
    addAlert({
      type: 'info',
      message: 'Auto-monitoring disabled',
      timestamp: new Date()
    });
  }
  
  saveUserPreferences();
}

function updateRefreshRate() {
  refreshInterval = parseInt(document.getElementById("refresh-rate").value);
  
  if (monitoringTimer) {
    clearInterval(monitoringTimer);
    startRealTimeMonitoring();
  }
  
  addAlert({
    type: 'info',
    message: `Refresh rate updated to ${refreshInterval / 1000} seconds`,
    timestamp: new Date()
  });
  
  saveUserPreferences();
}

function simulateIncident() {
  const detailedIncidents = [
    {
      type: 'critical',
      message: '🚨 BGP Session Failure: Neighbor 192.168.1.100 Down - External connectivity compromised',
      details: 'WAN link instability detected, 95% packet loss to ISP gateway. Physical inspection required.',
      logEntry: '%BGP-3-NOTIFICATION: sent to neighbor 192.168.1.100 active 4/0 (hold time expired)\n%BGP-5-ADJCHANGE: neighbor 192.168.1.100 Down'
    },
    {
      type: 'critical',
      message: '⚡ Port Security Violation: Fa0/15 err-disabled - Unauthorized device detected',
      details: 'Unknown MAC 00:1B:44:11:3A:B7 triggered port security. Cable and device inspection needed.',
      logEntry: '%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation on interface FastEthernet0/15\n%PM-4-ERR_DISABLE: psecure-violation error detected'
    },
    {
      type: 'critical', 
      message: '🔥 Core Router CPU Spike: 96% utilization - Performance degradation imminent',
      details: 'IP Input process consuming excessive resources. Temperature 69°C. Cooling and process analysis required.',
      logEntry: '%SYS-1-CPUHOG: Task is running for (2001)msecs\nCPU utilization: 96%/89%; Device temp: 69°C'
    },
    {
      type: 'critical',
      message: '🔒 Authentication Breach Detected: Multiple failed logins from 192.168.50.100',
      details: 'Brute force attack in progress. 47 failed attempts in 5 minutes. Security lockdown initiated.',
      logEntry: '%SEC_LOGIN-4-LOGIN_FAILED: Multiple failures from 192.168.50.100\n%AAA-3-ACCT_LOW_MEM_UID_FAIL: AAA memory exhaustion'
    },
    {
      type: 'warning',
      message: '📡 Interface Errors: Gi0/1 showing high error rates and duplex mismatch',
      details: 'CRC errors: 1,247, Collisions: 456. Cable test shows short at 45m. Physical replacement needed.',
      logEntry: '%LINK-3-UPDOWN: Interface GigabitEthernet0/1 state change\nDuplex mismatch: Local(Full) Remote(Half)'
    },
    {
      type: 'warning',
      message: '🌐 OSPF Adjacency Flapping: Neighbor 10.0.0.1 unstable for 15 minutes',
      details: 'Hello timer mismatch detected. Area 0 topology changes affecting routing convergence.',
      logEntry: '%OSPF-5-ADJCHANGE: Process 1, Nbr 10.0.0.1 from FULL to DOWN\nHello/Dead timer mismatch: 10/40 vs 5/20'
    },
    {
      type: 'critical',
      message: '💾 Memory Exhaustion: Core switch at 94% memory utilization',
      details: 'Routing table bloat detected. 2.1M routes consuming 890MB. Memory upgrade or route filtering needed.',
      logEntry: '%SYS-2-MALLOCFAIL: Memory allocation failure\nMemory usage: 94% (890MB/950MB total)'
    },
    {
      type: 'critical',
      message: '🌊 Broadcast Storm: 850,000 PPS detected on VLAN 100',
      details: 'Spanning tree failure creating network loop. Multiple ports err-disabled. Emergency isolation required.',
      logEntry: '%STORM_CONTROL-3-FILTERED: Broadcast storm detected on Gi0/12\n%PM-4-ERR_DISABLE: bpduguard error on multiple interfaces'
    },
    {
      type: 'warning',
      message: '🔋 Power Supply Redundancy Lost: PSU-2 failed on core switch',
      details: 'Single power supply operation. Load at 87%. Replacement required within maintenance window.',
      logEntry: '%POWER-6-SUPPLY_FAILURE: Power supply 2 failed\n%POWER-4-LOAD_WARNING: Running on single PSU at 87% load'
    },
    {
      type: 'critical',
      message: '🌡️ Thermal Emergency: Router temperature 74°C - Shutdown imminent',
      details: 'Cooling fans failing. Airflow blocked. Immediate physical intervention required to prevent equipment damage.',
      logEntry: '%THERMAL-1-OVERTEMP: System temperature critical: 74°C\n%FAN-3-FAN_FAILURE: Fan module 1 RPM below threshold'
    }
  ];
  
  const incident = detailedIncidents[Math.floor(Math.random() * detailedIncidents.length)];
  
  // Add the incident to alerts
  addAlert({
    type: incident.type,
    message: incident.message,
    timestamp: new Date(),
    details: incident.details
  });
  
  // Add detailed log entry to alerts for context
  setTimeout(() => {
    addAlert({
      type: 'info',
      message: `📋 Log Context: ${incident.logEntry.split('\n')[0]}`,
      timestamp: new Date()
    });
  }, 1500);
  
  // Add troubleshooting hint
  setTimeout(() => {
    const hints = [
      "💡 Check physical connections and cable integrity",
      "🔍 Run diagnostic commands to identify root cause",
      "⚡ Verify power supply and temperature status",
      "🌐 Test connectivity to critical network segments",
      "📊 Monitor performance metrics for 30 minutes",
      "🔧 Consider failover to backup systems if available"
    ];
    
    addAlert({
      type: 'info',
      message: `${hints[Math.floor(Math.random() * hints.length)]}`,
      timestamp: new Date()
    });
  }, 3000);
  
  // Simulate corresponding data changes based on incident type
  if (incident.message.includes('CPU')) {
    networkData.cpu = Math.random() * 10 + 90; // 90-100%
    networkData.latency += Math.random() * 100;
  } else if (incident.message.includes('BGP') || incident.message.includes('OSPF')) {
    networkData.latency += Math.random() * 200;
    networkData.connections = Math.max(0, networkData.connections - Math.random() * 50);
  } else if (incident.message.includes('Memory')) {
    networkData.memory = Math.random() * 10 + 90; // 90-100%
  } else if (incident.message.includes('Interface') || incident.message.includes('Port')) {
    networkData.packetLoss += Math.random() * 5;
    networkData.jitter += Math.random() * 15;
  }
  
  updateNetworkMetrics(networkData);
}

function clearAnalysis() {
  document.getElementById("analysis-output").innerHTML = `
    <div style="text-align: center; opacity: 0.5; padding: 40px;">
      <div style="font-size: 3em; margin-bottom: 15px;">🧹</div>
      <div>Analysis cleared</div>
      <small>Ready for new log analysis</small>
    </div>
  `;
  document.getElementById("log-input").value = "";
}

// Enhanced Export Functions with user info
function exportDetailedPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Enhanced Header
  doc.setFontSize(18);
  doc.text("🚀 AI Network Enterprise Analysis Report", 20, 20);
  
  doc.setFontSize(12);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
  doc.text(`Analyst: ${currentUser.name} (${currentUser.role || 'Network Analyst'})`, 20, 40);
  doc.text(`Report ID: NET-${Date.now().toString().slice(-8)}`, 20, 50);
  
  // Network Status
  doc.setFontSize(14);
  doc.text("Current Network Status", 20, 70);
  doc.setFontSize(10);
  doc.text(`Active Connections: ${networkData.connections}`, 20, 80);
  doc.text(`Average Latency: ${networkData.latency}ms`, 20, 90);
  doc.text(`Network Status: ${document.getElementById("network-status").textContent}`, 20, 100);
  doc.text(`Total Devices: ${networkDevices.length}`, 20, 110);
  doc.text(`Active Links: ${networkDevices.length + 3}`, 20, 120);
  
  // Recent Alerts (enhanced)
  doc.setFontSize(14);
  doc.text("Recent Network Alerts", 20, 140);
  doc.setFontSize(9);
  
  let yPos = 150;
  alertsHistory.slice(0, 20).forEach(alert => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    const alertText = `[${alert.timestamp.toLocaleTimeString()}] ${alert.type.toUpperCase()}: ${alert.message}`;
    const lines = doc.splitTextToSize(alertText, 170);
    doc.text(lines, 20, yPos);
    yPos += (lines.length * 5) + 3;
  });
  
  // Analysis Results
  const analysisOutput = document.getElementById("analysis-output").textContent;
  if (analysisOutput && analysisOutput.trim()) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Log Analysis Results", 20, 20);
    doc.setFontSize(9);
    
    const lines = doc.splitTextToSize(analysisOutput, 170);
    doc.text(lines, 20, 30);
  }
  
  doc.save(`network_enterprise_analysis_${currentUser.name}_${new Date().toISOString().split('T')[0]}.pdf`);
  
  addAlert({
    type: 'info',
    message: 'Comprehensive enterprise report generated successfully',
    timestamp: new Date()
  });
}

function exportCSV() {
  const csvData = [
    ['Timestamp', 'User', 'Connections', 'Latency', 'CPU', 'Memory', 'Disk', 'In Traffic', 'Out Traffic', 'Status'],
    ...trafficChart.data.labels.map((label, index) => [
      label,
      currentUser.name,
      networkData.connections,
      networkData.latency,
      Math.round(resourceChart.data.datasets[0].data[0]),
      Math.round(resourceChart.data.datasets[0].data[1]),
      Math.round(resourceChart.data.datasets[0].data[2]),
      trafficChart.data.datasets[0].data[index] || 0,
      trafficChart.data.datasets[1].data[index] || 0,
      document.getElementById("network-status").textContent
    ])
  ];
  
  const csvContent = csvData.map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `network_enterprise_data_${currentUser.name}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  addAlert({
    type: 'info',
    message: 'Enterprise CSV data exported successfully',
    timestamp: new Date()
  });
}

function exportJSON() {
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      analyst: currentUser.name,
      role: currentUser.role || 'Network Analyst',
      reportId: `NET-${Date.now().toString().slice(-8)}`,
      reportType: 'Enterprise Network Analysis'
    },
    networkMetrics: networkData,
    topology: {
      devices: networkDevices,
      totalDevices: networkDevices.length,
      networkSegments: 4,
      activeLinks: networkDevices.length + 3
    },
    alerts: alertsHistory.slice(0, 50),
    analytics: {
      topTalkers: topTalkers,
      networkEvents: networkEvents.slice(0, 20)
    },
    trafficData: {
      labels: trafficChart?.data?.labels || [],
      inTraffic: trafficChart?.data?.datasets?.[0]?.data || [],
      outTraffic: trafficChart?.data?.datasets?.[1]?.data || []
    },
    resourceData: {
      cpu: resourceChart?.data?.datasets?.[0]?.data?.[0] || 0,
      memory: resourceChart?.data?.datasets?.[0]?.data?.[1] || 0,
      disk: resourceChart?.data?.datasets?.[0]?.data?.[2] || 0
    },
    userPreferences: userPreferences[currentUser.name] || {}
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `network_enterprise_analysis_${currentUser.name}_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  addAlert({
    type: 'info',
    message: 'Complete enterprise JSON data exported successfully',
    timestamp: new Date()
  });
}

// Export Functions
function exportTopology() {
  const topologyData = {
    devices: networkDevices,
    timestamp: new Date().toISOString(),
    user: currentUser.name,
    totalDevices: networkDevices.length,
    networkSegments: 4,
    activeLinks: networkDevices.length + 3
  };
  
  const blob = new Blob([JSON.stringify(topologyData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `network_topology_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  addAlert({
    type: 'info',
    message: 'Network topology exported successfully',
    timestamp: new Date()
  });
}

function exportTopologyPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text("🌐 Network Topology Report", 20, 20);
  
  doc.setFontSize(12);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
  doc.text(`Analyst: ${currentUser.name}`, 20, 40);
  
  // Topology Summary
  doc.setFontSize(14);
  doc.text("Topology Summary", 20, 60);
  doc.setFontSize(10);
  doc.text(`Total Devices: ${networkDevices.length}`, 20, 70);
  doc.text(`Active Links: ${networkDevices.length + 3}`, 20, 80);
  doc.text(`Network Segments: 4`, 20, 90);
  doc.text(`Redundant Paths: 2`, 20, 100);
  
  // Device List
  doc.setFontSize(14);
  doc.text("Network Devices", 20, 120);
  doc.setFontSize(9);
  
  let yPos = 130;
  networkDevices.forEach((device, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(`${index + 1}. ${device.label} (${device.type}) - ${device.ip} - Status: ${device.status}`, 20, yPos);
    yPos += 10;
  });
  
  doc.save(`network_topology_report_${new Date().toISOString().split('T')[0]}.pdf`);
  
  addAlert({
    type: 'info',
    message: 'Network topology PDF report generated',
    timestamp: new Date()
  });
}

// Add after the window.addEventListener at the very end

// Help Modal Functions
function showHelp() {
  document.getElementById('help-modal').style.display = 'block';
}

function closeHelp() {
  document.getElementById('help-modal').style.display = 'none';
}

// Close modal when clicking outside of it
window.onclick = function(event) {
  const modal = document.getElementById('help-modal');
  if (event.target == modal) {
    modal.style.display = 'none';
  }
}

// Window unload event to save data
window.addEventListener('beforeunload', function() {
  localStorage.setItem('networkAnalyzerUsers', JSON.stringify(users));
  localStorage.setItem('networkAlerts', JSON.stringify(alertsHistory.slice(0, 100)));
  if (currentUser) {
    saveUserPreferences();
  }
});

// Quick Diagnostic Assistant
function quickDiagnostic(alertMessage) {
  let diagnosticSteps = [];
  let urgency = 'info';
  
  if (alertMessage.toLowerCase().includes('cpu')) {
    urgency = 'critical';
    diagnosticSteps = [
      '🚨 IMMEDIATE: Check "show processes cpu sorted" to identify top process',
      '🌡️ Verify device temperature and cooling system status', 
      '📊 Review interface utilization for traffic floods',
      '🔧 Consider stopping non-essential services temporarily',
      '⚠️ Prepare for potential device failover if CPU stays above 95%'
    ];
  } else if (alertMessage.toLowerCase().includes('bgp')) {
    urgency = 'critical';
    diagnosticSteps = [
      '🌐 Test connectivity: ping BGP neighbor IP address',
      '🔌 Check WAN interface status and cable connections',
      '📋 Verify BGP configuration matches peer settings',
      '🔍 Review routing table for missing external routes',
      '📞 Contact ISP if WAN link issues confirmed'
    ];
  } else if (alertMessage.toLowerCase().includes('err-disabled')) {
    urgency = 'critical';
    diagnosticSteps = [
      '🔌 IMMEDIATE: Disconnect unauthorized device if found',
      '🖥️ Check MAC address table for unknown devices',
      '📡 Test cable integrity with cable tester',
      '🔧 Clear err-disable state after resolving issue',
      '📋 Review port security configuration'
    ];
  } else if (alertMessage.toLowerCase().includes('memory')) {
    urgency = 'warning';
    diagnosticSteps = [
      '📊 Check "show processes memory sorted" for high consumers',
      '🧹 Clear unnecessary caches and counters',
      '📈 Review memory usage trends over past week',
      '💾 Consider memory upgrade if consistently high',
      '🔄 Plan restart of memory-intensive processes if needed'
    ];
  } else if (alertMessage.toLowerCase().includes('interface') || alertMessage.toLowerCase().includes('port')) {
    urgency = 'warning';
    diagnosticSteps = [
      '🔌 Test cable with cable tester (TDR if available)',
      '🔧 Verify speed/duplex settings on both ends',
      '📊 Check interface error counters and statistics',
      '🔄 Try different cable or port if possible',
      '📋 Document cable test results for replacement'
    ];
  } else if (alertMessage.toLowerCase().includes('authentication')) {
    urgency = 'critical';
    diagnosticSteps = [
      '🚨 IMMEDIATE: Block suspicious source IP addresses',
      '🔒 Force password reset for affected accounts',
      '🕵️ Review authentication logs for attack timeline',
      '🛡️ Enable account lockout and MFA if available',
      '📞 Alert security team and begin incident response'
    ];
  } else {
    diagnosticSteps = [
      '🔍 Gather more information about the issue',
      '📋 Check device logs for related entries',
      '📊 Review performance metrics and trends',
      '🌐 Test network connectivity to affected systems',
      '📞 Escalate to senior network engineer if needed'
    ];
  }
  
  // Create detailed diagnostic alert
  const diagnosticAlert = {
    type: urgency,
    message: `🔬 Quick Diagnostic Assistant: ${diagnosticSteps.length} immediate actions identified`,
    timestamp: new Date(),
    isQuickDiagnostic: true,
    diagnosticSteps: diagnosticSteps
  };
  
  addAlert(diagnosticAlert);
  
  // Add follow-up with specific steps
  setTimeout(() => {
    diagnosticSteps.forEach((step, index) => {
      setTimeout(() => {
        addAlert({
          type: 'info',
          message: `Step ${index + 1}: ${step}`,
          timestamp: new Date()
        });
      }, (index + 1) * 800);
    });
  }, 1000);
  
  return diagnosticSteps;
}

// Demo Enhanced Analysis Function
function demoEnhancedAnalysis() {
  // Switch to AI Analysis tab
  showTab('analysis');
  
  // Comprehensive sample log showcasing multiple issues
  const comprehensiveLog = `%BGP-3-NOTIFICATION: sent to neighbor 192.168.1.100 active 4/0 (hold time expired) 0 bytes
%BGP-5-NBR_RESET: Neighbor 192.168.1.100 reset (BGP Notification sent)  
%BGP-5-ADJCHANGE: neighbor 192.168.1.100 Down BGP Neighbor changed state to Idle
%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0, changed state to down
%OSPF-5-ADJCHANGE: Process 1, Nbr 10.0.0.1 on interface GigE0/1 from FULL to DOWN, Neighbor Down: Interface down or detached
%SYS-1-CPUHOG: Task is running for (2001)msecs, more than (2000)msecs  
CPU utilization for five seconds: 94%/89%; one minute: 87%; five minutes: 82%
Process: IP Input, CPU time: 4.2s/2.5s, Invoked: 12440 times, uSecs: 337
%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address 00:1b:44:11:3a:b7 on port FastEthernet0/15.
%PM-4-ERR_DISABLE: psecure-violation error detected on Fa0/15, putting interface in error-disabled state
%SEC_LOGIN-4-LOGIN_FAILED: Login failed [user: admin] [Source: 192.168.50.100] [localport: 22] at 14:23:47 UTC
%SEC_LOGIN-4-LOGIN_FAILED: Login failed [user: admin] [Source: 192.168.50.100] [localport: 22] at 14:23:52 UTC
%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down
Interface Gi0/1 statistics: Input errors: 1247, CRC errors: 892, Frame errors: 45, Overrun: 12, Ignored: 0
%DUAL-5-NBRCHANGE: EIGRP-IPv4 1: Neighbor 10.0.0.2 (GigabitEthernet0/2) is down: holding time expired
%SYS-2-MALLOCFAIL: Memory allocation of 65536 bytes failed from 0x62A5A14C, alignment 0
Memory usage warning: 91% (872MB) of total memory (958MB) in use
%THERMAL-1-OVERTEMP: System temperature has reached 71 degrees Celsius
%FAN-3-FAN_FAILURE: Fan unit 1 has failed (fan speed below minimum threshold)
Physical observations: WAN cable appears loose, unusual blinking pattern on Gi0/0 LED
Cable test results: Pair A OK (120m), Pair B Short at 45 meters, Pair C OK (120m), Pair D Open circuit
Device temperature measured at 71°C using external thermometer - cooling system failure suspected`;
  
  // Populate the log input
  document.getElementById('log-input').value = comprehensiveLog;
  
  // Add notification
  addAlert({
    type: 'info',
    message: '🎯 Demo Mode: Comprehensive network log loaded with multiple issues',
    timestamp: new Date()
  });
  
  setTimeout(() => {
    addAlert({
      type: 'info',
      message: '🚀 Starting enhanced AI analysis with point-to-point troubleshooting...',
      timestamp: new Date()
    });
  }, 1000);
  
  // Trigger AI analysis after a short delay
  setTimeout(() => {
    analyzeLogAI();
  }, 2000);
  
  // Add follow-up tip
  setTimeout(() => {
    addAlert({
      type: 'info',
      message: '💡 Pro Tip: Click "Quick Diagnostic" buttons on critical alerts for instant troubleshooting guidance',
      timestamp: new Date()
    });
  }, 8000);
}
