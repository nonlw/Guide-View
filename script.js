const app = document.getElementById('app');
const title = document.getElementById('viewTitle');
const breadcrumb = document.getElementById('breadcrumb');
const infoBar = document.getElementById('infoBar');
const modelStage = document.getElementById('modelStage');
const modelRoot = document.getElementById('floorModel3D');
const tooltip = document.getElementById('floorTooltip');
const infoPanel = document.getElementById('floorInfoPanel');
const buildingFocus = document.getElementById('buildingFocus');
const floorView = document.getElementById('floorView');
const toggleEditorButton = document.getElementById('toggleEditor');
const campusSceneRoot = document.getElementById('campusSceneRoot');
const svgNS = 'http://www.w3.org/2000/svg';

let floorModel = null;
let campusScene = null;

function setLayerVisibility(node, visible) {
  node.style.setProperty('opacity', visible ? '1' : '0', 'important');
  node.style.setProperty('visibility', visible ? 'visible' : 'hidden', 'important');
  node.style.setProperty('pointer-events', visible ? 'auto' : 'none', 'important');
  node.style.setProperty('z-index', visible ? '6' : '0', 'important');
  node.setAttribute('aria-hidden', visible ? 'false' : 'true');
  node.querySelectorAll('*').forEach((child) => {
    child.style.setProperty('visibility', visible ? 'visible' : 'hidden', 'important');
  });
}

function setStage(nextStage) {
  app.classList.remove('stage-area', 'stage-building', 'stage-floor');
  app.classList.add(nextStage);
  setLayerVisibility(buildingFocus, nextStage === 'stage-building');
  setLayerVisibility(floorView, nextStage === 'stage-floor');
}

function setAreaView() {
  setStage('stage-area');
  title.textContent = '民企区域 3D 总览';
  breadcrumb.textContent = '区域 / 民企区域';
  infoBar.textContent = '';
  campusScene?.resetView();
}

function setBuildingView() {
  setStage('stage-building');
  title.textContent = '民企区域 / 5栋';
  breadcrumb.textContent = '区域 / 民企区域 / 5栋';
  infoBar.textContent = '';
}

async function enterFloor() {
  setStage('stage-floor');
  title.textContent = '5栋 1F CAD 墙体模型';
  breadcrumb.textContent = '区域 / 民企区域 / 5栋 / 1F';
  infoBar.textContent = '';

  if (!floorModel) {
    floorModel = new CADFloorModel3D(modelRoot, tooltip, infoPanel);
    window.floorModel3D = floorModel;
    await floorModel.load('data/floors/minqi-building-5-1f-cad.json');
  }
}

window.enterFloor = enterFloor;

document.querySelector('[data-action="goArea"]').addEventListener('click', setAreaView);
document.getElementById('backToBuilding').addEventListener('click', setBuildingView);
document.getElementById('resetCampusView').addEventListener('click', () => campusScene?.resetView());
document.getElementById('resetView').addEventListener('click', () => {
  modelStage.classList.remove('show-pdf', 'top-view');
  floorModel?.resetZoom();
  floorModel?.render();
});
document.getElementById('viewTop').addEventListener('click', () => {
  modelStage.classList.toggle('top-view');
  floorModel?.render();
});
toggleEditorButton.addEventListener('click', () => floorModel?.setEditMode(!floorModel.editMode));

document.querySelectorAll('[data-building]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.building === 'b5') {
      setBuildingView();
      setLayerVisibility(buildingFocus, true);
      return;
    }
    if (button.dataset.building === 'b1' || button.dataset.building === 'b6') {
      infoBar.textContent = `${button.textContent.trim().slice(0, 2)}：待接入楼层`;
    }
  });
});
document.querySelectorAll('[data-floor]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    enterFloor();
  });
});
buildingFocus.addEventListener('click', (event) => {
  const floorButton = document.querySelector('[data-floor="b5f1"]');
  if (!floorButton) return;
  const rect = floorButton.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (inside || event.target.closest('[data-floor="b5f1"]')) enterFloor();
});

async function initCampusScene() {
  if (!campusSceneRoot) return;
  campusScene = new CampusScene3D(campusSceneRoot, {
    onBuildingClick(building) {
      if (building.id === 'building-5') {
        setBuildingView();
        setLayerVisibility(buildingFocus, true);
        return;
      }
      infoBar.textContent = `${building.name}：${building.status}`;
    },
  });
  await campusScene.load('data/areas/minqi-campus.json');
}

class CampusScene3D {
  constructor(root, options = {}) {
    this.root = root;
    this.options = options;
    this.scale = 3.9;
    this.centerX = 620;
    this.centerY = 330;
    this.data = null;
    this.svg = null;
  }

  async load(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot load campus data: ${url}`);
    this.data = await response.json();
    this.render();
  }

  resetView() {
    this.scale = 3.9;
    this.centerX = 620;
    this.centerY = 330;
    this.render();
  }

  render() {
    if (!this.data) return;
    this.root.innerHTML = '';
    this.svg = this.el('svg', {
      viewBox: '0 0 1220 650',
      role: 'img',
      'aria-label': `${this.data.name} 3D 办公园区`,
      class: 'campus-scene-svg',
    });
    this.renderDefs();
    this.renderGround();
    this.data.landscape.forEach((item) => new Landscape3D(this, item).render());
    this.data.roads.forEach((road) => new Road3D(this, road).render());
    this.renderBuildingPlazas();
    [...this.data.buildings]
      .sort((a, b) => a.position.z - b.position.z)
      .forEach((building) => new BuildingBlock3D(this, building).render());
    this.root.appendChild(this.svg);
  }

  renderDefs() {
    const defs = this.el('defs');
    const shadow = this.el('filter', { id: 'campusShadow', x: '-30%', y: '-30%', width: '160%', height: '180%' });
    shadow.appendChild(this.el('feDropShadow', {
      dx: '0',
      dy: '18',
      stdDeviation: '10',
      'flood-color': '#536575',
      'flood-opacity': '.18',
    }));
    defs.appendChild(shadow);
    this.svg.appendChild(defs);
  }

  renderGround() {
    const { width, depth } = this.data.ground;
    const ground = this.rectPoints(0, 0, width, depth);
    this.svg.appendChild(this.poly(ground.map((point) => this.project(point.x, point.z, 0)), {
      class: 'campus-ground',
    }));
    this.svg.appendChild(this.poly(this.rectPoints(0, 0, width - 10, depth - 10).map((point) => this.project(point.x, point.z, .1)), {
      class: 'campus-ground-inner',
    }));
  }

  renderBuildingPlazas() {
    this.data.buildings.forEach((building) => {
      const z = building.position.z + building.size.depth / 2 + 8;
      const points = this.rectPoints(building.position.x, z, building.size.width + 14, 8);
      this.svg.appendChild(this.poly(points.map((point) => this.project(point.x, point.z, .2)), {
        class: 'campus-entry-plaza',
      }));
    });
  }

  pathForSegment(a, b, width, y = .25) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = (-dz / length) * width / 2;
    const nz = (dx / length) * width / 2;
    return [
      { x: a.x + nx, z: a.z + nz },
      { x: b.x + nx, z: b.z + nz },
      { x: b.x - nx, z: b.z - nz },
      { x: a.x - nx, z: a.z - nz },
    ].map((point) => this.project(point.x, point.z, y));
  }

  rectPoints(x, z, width, depth) {
    return [
      { x: x - width / 2, z: z - depth / 2 },
      { x: x + width / 2, z: z - depth / 2 },
      { x: x + width / 2, z: z + depth / 2 },
      { x: x - width / 2, z: z + depth / 2 },
    ];
  }

  project(x, z, y = 0) {
    return {
      x: this.centerX + (x - z) * this.scale,
      y: this.centerY + (x + z) * this.scale * 0.46 - y * this.scale * 1.35,
    };
  }

  poly(points, attrs = {}) {
    return this.el('polygon', {
      points: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
      ...attrs,
    });
  }

  el(name, attrs = {}) {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
}

class BuildingBlock3D {
  constructor(scene, building) {
    this.scene = scene;
    this.building = building;
  }

  render() {
    const { scene, building } = this;
    const { x, z } = building.position;
    const { width, depth, height } = building.size;
    const group = scene.el('g', {
      class: `campus-building ${building.isPrimary ? 'is-primary' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${building.name} ${building.status}`,
    });

    const base = scene.rectPoints(x, z, width, depth);
    const top = base.map((point) => scene.project(point.x, point.z, height));
    const bottom = base.map((point) => scene.project(point.x, point.z, 0));
    group.appendChild(scene.poly(bottom, { class: 'building-shadow' }));
    group.appendChild(scene.poly([top[0], top[1], bottom[1], bottom[0]], { class: 'building-face building-front' }));
    group.appendChild(scene.poly([top[1], top[2], bottom[2], bottom[1]], { class: 'building-face building-side' }));
    group.appendChild(scene.poly([top[2], top[3], bottom[3], bottom[2]], { class: 'building-face building-back' }));
    group.appendChild(scene.poly([top[3], top[0], bottom[0], bottom[3]], { class: 'building-face building-side-left' }));
    group.appendChild(scene.poly(top, { class: 'building-roof' }));

    this.renderWindows(group, 'front');
    this.renderDoor(group);
    this.renderLabel(group);

    group.addEventListener('click', () => scene.options.onBuildingClick?.(building));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') scene.options.onBuildingClick?.(building);
    });
    scene.svg.appendChild(group);
  }

  renderWindows(group) {
    const { scene, building } = this;
    const floors = building.floors;
    const count = building.isPrimary ? 5 : 4;
    const widthStep = building.size.width / (count + 1);
    for (let col = 1; col <= count; col++) {
      const x = building.position.x - building.size.width / 2 + widthStep * col;
      const z = building.position.z + building.size.depth / 2 + .15;
      const bottom = scene.project(x, z, 6);
      const top = scene.project(x, z, building.size.height - 7);
      const line = scene.el('line', {
        x1: bottom.x,
        y1: bottom.y,
        x2: top.x,
        y2: top.y,
        class: 'building-window-strip',
      });
      group.appendChild(line);
    }
    for (let floor = 1; floor < floors; floor++) {
      const y = 5 + (building.size.height - 12) * floor / floors;
      const a = scene.project(building.position.x - building.size.width / 2 + 3, building.position.z + building.size.depth / 2 + .2, y);
      const b = scene.project(building.position.x + building.size.width / 2 - 3, building.position.z + building.size.depth / 2 + .2, y);
      group.appendChild(scene.el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'building-floor-line' }));
    }
  }

  renderDoor(group) {
    const { scene, building } = this;
    const doorWidth = building.isPrimary ? 9 : 7;
    const points = scene.rectPoints(building.position.x, building.position.z + building.size.depth / 2 + .35, doorWidth, 1);
    const a = scene.project(points[0].x, points[0].z, 0);
    const b = scene.project(points[1].x, points[1].z, 0);
    const c = scene.project(points[1].x, points[1].z, 10);
    const d = scene.project(points[0].x, points[0].z, 10);
    group.appendChild(scene.poly([a, b, c, d], { class: 'building-door' }));
  }

  renderLabel(group) {
    const { scene, building } = this;
    const anchor = scene.project(building.position.x, building.position.z + building.size.depth / 2 + 2, 14);
    const label = scene.el('text', { x: anchor.x, y: anchor.y, class: 'building-name', 'text-anchor': 'middle' });
    label.textContent = building.name;
    const status = scene.el('text', { x: anchor.x, y: anchor.y + 22, class: 'building-status', 'text-anchor': 'middle' });
    status.textContent = building.status;
    group.appendChild(label);
    group.appendChild(status);
  }
}

class Road3D {
  constructor(scene, road) {
    this.scene = scene;
    this.road = road;
  }

  render() {
    const group = this.scene.el('g', { class: `campus-road-3d road-${this.road.type}` });
    for (let index = 0; index < this.road.points.length - 1; index++) {
      group.appendChild(this.scene.poly(this.scene.pathForSegment(this.road.points[index], this.road.points[index + 1], this.road.width), {
        class: 'road-surface',
      }));
    }
    this.scene.svg.appendChild(group);
  }
}

class Landscape3D {
  constructor(scene, item) {
    this.scene = scene;
    this.item = item;
  }

  render() {
    const { scene, item } = this;
    const points = scene.rectPoints(item.position.x, item.position.z, item.size.width, item.size.depth);
    const group = scene.el('g', { class: `campus-landscape landscape-${item.type}` });
    group.appendChild(scene.poly(points.map((point) => scene.project(point.x, point.z, .18)), { class: 'landscape-surface' }));
    if (item.type === 'green-belt') this.renderTrees(group);
    if (item.type === 'parking') this.renderParkingLines(group);
    scene.svg.appendChild(group);
  }

  renderTrees(group) {
    const { scene, item } = this;
    [-.3, 0, .3].forEach((offset) => {
      const p = scene.project(item.position.x + item.size.width * offset, item.position.z, 1.2);
      group.appendChild(scene.el('circle', { cx: p.x, cy: p.y, r: 5, class: 'campus-tree' }));
    });
  }

  renderParkingLines(group) {
    const { scene, item } = this;
    for (let index = -2; index <= 2; index++) {
      const a = scene.project(item.position.x + index * 3, item.position.z - item.size.depth / 2 + 1, .35);
      const b = scene.project(item.position.x + index * 3, item.position.z + item.size.depth / 2 - 1, .35);
      group.appendChild(scene.el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'parking-line' }));
    }
  }
}

initCampusScene();

class CADFloorModel3D {
  constructor(root, tooltipNode, panelNode) {
    this.root = root;
    this.tooltip = tooltipNode;
    this.panel = panelNode;
    this.scale = 5.2;
    this.centerX = 610;
    this.centerY = 208;
    this.storageKey = 'minqi-guidance:building-5:1f:cad-model-data:v2';
    this.data = null;
    this.originalData = null;
    this.svg = null;
    this.editMode = false;
    this.editTarget = 'zone';
    this.activeZoneId = null;
    this.activeWallId = null;
    this.zoom = 1;
    this.drag = null;
    this.bindViewportGestures();
  }

  async load(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot load floor data: ${url}`);
    this.originalData = await response.json();
    this.data = this.loadDraft() || this.clone(this.originalData);
    document.querySelector('.cad-underlay')?.setAttribute('src', this.data.cadUnderlay);
    this.render();
    this.selectZone(this.data.zones[0]);
  }

  render() {
    this.root.innerHTML = '';
    this.svg = this.el('svg', {
      viewBox: '0 0 1220 720',
      role: 'img',
      'aria-label': `${this.data.name} CAD 重建低模`,
    });

    const defs = this.el('defs');
    const filter = this.el('filter', { id: 'isoShadow', x: '-20%', y: '-20%', width: '140%', height: '160%' });
    filter.appendChild(this.el('feDropShadow', {
      dx: '0',
      dy: '18',
      stdDeviation: '10',
      'flood-color': '#61707d',
      'flood-opacity': '.22',
    }));
    defs.appendChild(filter);
    this.svg.appendChild(defs);

    this.svg.appendChild(this.prism(this.data.slabPolygon, {
      height: 1.1,
      color: '#eff2f4',
      className: 'iso-slab',
      opacity: 1,
      y: -1.1,
    }));

    const zones = this.el('g', { class: 'iso-zones' });
    this.data.zones.forEach((zone) => zones.appendChild(this.renderZone(zone)));
    this.svg.appendChild(zones);

    const walls = this.el('g', { class: 'iso-walls', filter: 'url(#isoShadow)' });
    this.data.walls.forEach((wall) => walls.appendChild(this.renderWall(wall)));
    this.svg.appendChild(walls);

    const columns = this.el('g', { class: 'iso-columns', filter: 'url(#isoShadow)' });
    this.data.columns.forEach((column) => columns.appendChild(this.box({
      x: column.position.x,
      z: column.position.z,
      width: column.size.width,
      depth: column.size.depth,
      height: column.height,
      color: '#6f8393',
      className: 'iso-column',
    })));
    this.svg.appendChild(columns);

    const traffic = this.el('g', { class: 'iso-furniture' });
    this.data.verticalTraffic.forEach((item) => this.renderVerticalTraffic(item, traffic));
    this.svg.appendChild(traffic);

    const labels = this.el('g', { class: 'iso-labels' });
    this.data.zones.forEach((zone) => labels.appendChild(this.renderLabel(zone)));
    this.svg.appendChild(labels);

    this.root.appendChild(this.svg);
    this.restoreActiveSelection();
  }

  renderZone(zone) {
    const node = this.prism(zone.polygon, {
      height: 0.24,
      color: zone.color,
      className: `iso-zone zone-${zone.type}`,
      opacity: zone.opacity || 0.34,
    });
    node.dataset.zoneId = zone.id;
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', zone.name);
    node.addEventListener('pointerenter', () => {
      node.classList.add('is-hovered');
      this.showTooltip(zone.name);
    });
    node.addEventListener('pointermove', (event) => this.moveTooltip(event));
    node.addEventListener('pointerleave', () => {
      node.classList.remove('is-hovered');
      this.hideTooltip();
    });
    node.addEventListener('click', () => this.selectZone(zone));
    node.addEventListener('pointerdown', (event) => this.startDrag(event, 'zone', zone.id));
    return node;
  }

  renderWall(wall) {
    const node = this.wallSegment(wall.start, wall.end, {
      height: wall.height || 2.6,
      thickness: wall.thickness || 0.28,
      color: wall.type === 'outer' ? '#f8fafb' : '#d8e0e7',
      className: `iso-wall wall-${wall.type}`,
    });
    node.dataset.wallId = wall.id;
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', wall.id);
    node.addEventListener('pointerenter', () => {
      node.classList.add('is-hovered');
      this.showTooltip(`${wall.type === 'outer' ? '外墙' : '内墙'} · ${wall.id}`);
    });
    node.addEventListener('pointermove', (event) => this.moveTooltip(event));
    node.addEventListener('pointerleave', () => {
      node.classList.remove('is-hovered');
      this.hideTooltip();
    });
    node.addEventListener('click', () => this.selectWall(wall));
    node.addEventListener('pointerdown', (event) => this.startDrag(event, 'wall', wall.id));
    return node;
  }

  renderVerticalTraffic(item, parent) {
    if (item.type === 'elevator') {
      parent.appendChild(this.box({
        x: item.position.x,
        z: item.position.z,
        width: 4.2,
        depth: 4.2,
        height: 1.55,
        color: '#8d9aa6',
        className: 'elevator-block',
      }));
      return;
    }
    for (let step = 0; step < 6; step++) {
      parent.appendChild(this.box({
        x: item.position.x + step * 0.9,
        z: item.position.z + step * 0.45,
        width: 1.2,
        depth: 4.8,
        height: 0.24 + step * 0.18,
        color: '#c4ced6',
        className: 'stair-block',
      }));
    }
  }

  renderLabel(zone) {
    const center = this.zoneCenter(zone);
    const p = this.project(center.x, center.z, 4);
    const label = this.el('text', { x: p.x, y: p.y, class: 'iso-label', 'text-anchor': 'middle' });
    label.textContent = zone.name;
    return label;
  }

  selectZone(zone) {
    this.editTarget = 'zone';
    this.activeZoneId = zone.id;
    this.activeWallId = null;
    this.restoreActiveSelection();
    if (this.editMode) {
      this.renderZoneEditor(zone);
      return;
    }
    this.panel.innerHTML = `
      <div class="panel-kicker">${this.data.name}</div>
      <h3>${zone.name}</h3>
      <p>待补充正式房间名称</p>
      <dl>
        <div><dt>区域类型</dt><dd>${this.typeLabel(zone.type)}</dd></div>
        <div><dt>所属楼栋</dt><dd>5栋</dd></div>
        <div><dt>所属楼层</dt><dd>1F</dd></div>
        <div><dt>备注</dt><dd>待补充正式房间名称</dd></div>
      </dl>
    `;
  }

  selectWall(wall) {
    this.editTarget = 'wall';
    this.activeWallId = wall.id;
    this.activeZoneId = null;
    this.restoreActiveSelection();
    if (this.editMode) {
      this.renderWallEditor(wall);
      return;
    }
    this.panel.innerHTML = `
      <div class="panel-kicker">Wall Detail</div>
      <h3>${wall.type === 'outer' ? '外墙' : '内墙'}</h3>
      <p>${wall.id}</p>
      <dl>
        <div><dt>起点</dt><dd>${wall.start.x}, ${wall.start.z}</dd></div>
        <div><dt>终点</dt><dd>${wall.end.x}, ${wall.end.z}</dd></div>
        <div><dt>高度</dt><dd>${wall.height}</dd></div>
        <div><dt>厚度</dt><dd>${wall.thickness}</dd></div>
      </dl>
    `;
  }

  restoreActiveSelection() {
    this.svg?.querySelectorAll('.iso-zone').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.zoneId === this.activeZoneId);
    });
    this.svg?.querySelectorAll('.iso-wall').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.wallId === this.activeWallId);
    });
  }

  setEditMode(enabled) {
    this.editMode = enabled;
    modelStage.classList.toggle('editing', enabled);
    toggleEditorButton.classList.toggle('active', enabled);
    toggleEditorButton.textContent = enabled ? '完成编辑' : '编辑模型';
    if (this.editTarget === 'wall' && this.getActiveWall()) this.renderWallEditor(this.getActiveWall());
    else this.renderZoneEditor(this.getActiveZone() || this.data.zones[0]);
  }

  renderEditorTabs() {
    return `
      <div class="editor-tabs">
        <button type="button" data-editor-target="zone" class="${this.editTarget === 'zone' ? 'active' : ''}">区域</button>
        <button type="button" data-editor-target="wall" class="${this.editTarget === 'wall' ? 'active' : ''}">墙体</button>
      </div>
    `;
  }

  bindEditorTabs() {
    this.panel.querySelectorAll('[data-editor-target]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.editorTarget === 'wall') {
          this.editTarget = 'wall';
          this.renderWallEditor(this.getActiveWall() || this.data.walls[0]);
        } else {
          this.editTarget = 'zone';
          this.renderZoneEditor(this.getActiveZone() || this.data.zones[0]);
        }
      });
    });
  }

  renderZoneEditor(zone) {
    this.editTarget = 'zone';
    this.activeZoneId = zone.id;
    this.activeWallId = null;
    const box = this.zoneBox(zone);
    this.panel.innerHTML = `
      <div class="panel-kicker">Model Editor</div>
      ${this.renderEditorTabs()}
      <h3>${zone.name}</h3>
      <p>编辑区域的位置、尺寸、颜色；也可以新增或删除区域。</p>
      <label class="editor-field wide"><span>区域名称</span><input type="text" data-zone-field="name" value="${zone.name}"></label>
      <label class="editor-field wide"><span>区域类型</span>${this.typeSelect('type', zone.type)}</label>
      <div class="editor-form">
        ${this.numberControl('X 位置', 'position.x', box.x, -90, 90, 1, 'zone')}
        ${this.numberControl('Z 位置', 'position.z', box.z, -38, 38, 1, 'zone')}
        ${this.numberControl('宽度', 'size.width', box.width, 4, 110, 1, 'zone')}
        ${this.numberControl('深度', 'size.depth', box.depth, 4, 65, 1, 'zone')}
        <label class="editor-field color-field">
          <span>色块</span>
          <input type="color" data-zone-field="color" value="${zone.color}">
          <em>${zone.color}</em>
        </label>
      </div>
      <div class="editor-actions three">
        <button type="button" data-editor-action="add-zone">新增区域</button>
        <button type="button" data-editor-action="delete-zone">删除区域</button>
        <button type="button" data-editor-action="copy">复制 JSON</button>
        <button type="button" data-editor-action="reset">重置修改</button>
      </div>
    `;
    this.bindEditorTabs();
    this.bindZoneEditor(zone.id);
  }

  renderWallEditor(wall) {
    this.editTarget = 'wall';
    this.activeWallId = wall.id;
    this.activeZoneId = null;
    this.panel.innerHTML = `
      <div class="panel-kicker">Wall Editor</div>
      ${this.renderEditorTabs()}
      <h3>${wall.type === 'outer' ? '外墙' : '内墙'}</h3>
      <p>编辑墙体起点、终点、高度、厚度；也可以新增或删除墙体。</p>
      <label class="editor-field wide"><span>墙体 ID</span><input type="text" data-wall-field="id" value="${wall.id}"></label>
      <label class="editor-field wide"><span>墙体类型</span>
        <select data-wall-field="type">
          <option value="inner" ${wall.type === 'inner' ? 'selected' : ''}>内墙</option>
          <option value="outer" ${wall.type === 'outer' ? 'selected' : ''}>外墙</option>
        </select>
      </label>
      <div class="editor-form">
        ${this.numberControl('起点 X', 'start.x', wall.start.x, -90, 90, 1, 'wall')}
        ${this.numberControl('起点 Z', 'start.z', wall.start.z, -38, 38, 1, 'wall')}
        ${this.numberControl('终点 X', 'end.x', wall.end.x, -90, 90, 1, 'wall')}
        ${this.numberControl('终点 Z', 'end.z', wall.end.z, -38, 38, 1, 'wall')}
        ${this.numberControl('高度', 'height', wall.height, 0.4, 5, 0.1, 'wall')}
        ${this.numberControl('厚度', 'thickness', wall.thickness, 0.1, 1.5, 0.05, 'wall')}
      </div>
      <div class="editor-actions three">
        <button type="button" data-editor-action="add-wall">新增墙体</button>
        <button type="button" data-editor-action="delete-wall">删除墙体</button>
        <button type="button" data-editor-action="copy">复制 JSON</button>
        <button type="button" data-editor-action="reset">重置修改</button>
      </div>
    `;
    this.bindEditorTabs();
    this.bindWallEditor(wall.id);
  }

  bindZoneEditor(zoneId) {
    this.panel.querySelectorAll('[data-zone-field]').forEach((input) => {
      input.addEventListener(input.type === 'color' ? 'input' : 'change', () => {
        this.updateZoneField(zoneId, input.dataset.zoneField, input.value);
      });
    });
    this.bindCommonActions();
  }

  bindWallEditor(wallId) {
    this.panel.querySelectorAll('[data-wall-field]').forEach((input) => {
      input.addEventListener('change', () => this.updateWallField(wallId, input.dataset.wallField, input.value));
    });
    this.bindCommonActions();
  }

  bindCommonActions() {
    const actions = {
      copy: () => this.copyCurrentJson(),
      reset: () => this.resetDraft(),
      'add-zone': () => this.addZone(),
      'delete-zone': () => this.deleteActiveZone(),
      'add-wall': () => this.addWall(),
      'delete-wall': () => this.deleteActiveWall(),
    };
    this.panel.querySelectorAll('[data-editor-action]').forEach((button) => {
      button.addEventListener('click', () => actions[button.dataset.editorAction]?.());
    });
  }

  bindViewportGestures() {
    modelStage.addEventListener('wheel', (event) => {
      if (!app.classList.contains('stage-floor')) return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      this.setZoom(this.zoom * factor);
    }, { passive: false });

    modelStage.addEventListener('pointermove', (event) => this.moveDrag(event));
    modelStage.addEventListener('pointerup', () => this.endDrag());
    modelStage.addEventListener('pointerleave', () => this.endDrag());
  }

  setZoom(value) {
    this.zoom = Math.max(0.55, Math.min(2.4, value));
    this.root.style.setProperty('--model-zoom', this.zoom.toFixed(3));
  }

  resetZoom() {
    this.setZoom(1);
  }

  startDrag(event, type, id) {
    if (!this.editMode) return;
    event.preventDefault();
    event.stopPropagation();
    if (type === 'zone') this.selectZone(this.data.zones.find((zone) => zone.id === id));
    if (type === 'wall') this.selectWall(this.data.walls.find((wall) => wall.id === id));
    this.drag = { type, id, x: event.clientX, y: event.clientY };
    modelStage.classList.add('dragging-object');
    if (modelStage.setPointerCapture) modelStage.setPointerCapture(event.pointerId);
  }

  moveDrag(event) {
    if (!this.drag) return;
    const delta = this.screenDeltaToModel(event.clientX - this.drag.x, event.clientY - this.drag.y);
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;

    if (this.drag.type === 'zone') {
      const zone = this.data.zones.find((item) => item.id === this.drag.id);
      if (!zone) return;
      zone.polygon = zone.polygon.map((point) => ({ x: point.x + delta.x, z: point.z + delta.z }));
      this.persistDraft();
      this.render();
      this.renderZoneEditor(zone);
      return;
    }

    const wall = this.data.walls.find((item) => item.id === this.drag.id);
    if (!wall) return;
    wall.start.x += delta.x;
    wall.start.z += delta.z;
    wall.end.x += delta.x;
    wall.end.z += delta.z;
    this.persistDraft();
    this.render();
    this.renderWallEditor(wall);
  }

  endDrag() {
    if (!this.drag) return;
    this.drag = null;
    modelStage.classList.remove('dragging-object');
  }

  screenDeltaToModel(screenDx, screenDy) {
    const svgRect = this.svg?.getBoundingClientRect();
    const viewScale = svgRect ? svgRect.width / 1220 : 1;
    const dx = screenDx / Math.max(viewScale, 0.01);
    const dy = screenDy / Math.max(viewScale, 0.01);
    const modelScale = this.scale;

    if (modelStage.classList.contains('top-view')) {
      return { x: dx / modelScale, z: dy / modelScale };
    }

    const sx = dx / modelScale;
    const sy = dy / (modelScale * 0.46);
    return {
      x: (sx + sy) / 2,
      z: (sy - sx) / 2,
    };
  }

  numberControl(label, field, value, min, max, step, target) {
    return `<label class="editor-field"><span>${label}</span><input type="number" data-${target}-field="${field}" value="${this.round(value)}" min="${min}" max="${max}" step="${step}"></label>`;
  }

  typeSelect(field, value) {
    const options = [
      ['office', '办公区'],
      ['training', '会议/培训区'],
      ['service', '设备/卫生间区'],
      ['public', '公共区'],
      ['restricted', '重点/不可访问区'],
      ['vertical-traffic', '楼梯/电梯/出入口'],
    ];
    return `<select data-zone-field="${field}">${options.map(([id, label]) => `<option value="${id}" ${id === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
  }

  updateZoneField(zoneId, field, rawValue) {
    const zone = this.data.zones.find((item) => item.id === zoneId);
    if (!zone) return;
    if (field === 'name' || field === 'type' || field === 'color') {
      zone[field] = rawValue;
    } else {
      const box = this.zoneBox(zone);
      if (field === 'position.x') box.x = Number(rawValue);
      if (field === 'position.z') box.z = Number(rawValue);
      if (field === 'size.width') box.width = Math.max(1, Number(rawValue));
      if (field === 'size.depth') box.depth = Math.max(1, Number(rawValue));
      this.applyZoneBox(zone, box);
    }
    this.persistDraft();
    this.render();
    this.renderZoneEditor(zone);
  }

  updateWallField(wallId, field, rawValue) {
    const wall = this.data.walls.find((item) => item.id === wallId);
    if (!wall) return;
    const value = field === 'id' || field === 'type' ? rawValue : Number(rawValue);
    if (field === 'id') {
      wall.id = this.uniqueId(rawValue || 'wall', this.data.walls, wall.id);
      this.activeWallId = wall.id;
    } else if (field === 'type') wall.type = value;
    else if (field === 'start.x') wall.start.x = value;
    else if (field === 'start.z') wall.start.z = value;
    else if (field === 'end.x') wall.end.x = value;
    else if (field === 'end.z') wall.end.z = value;
    else if (field === 'height') wall.height = value;
    else if (field === 'thickness') wall.thickness = value;
    this.persistDraft();
    this.render();
    this.renderWallEditor(wall);
  }

  addZone() {
    const id = this.uniqueId('zone-new', this.data.zones);
    const zone = {
      id,
      name: '新增区域',
      type: 'office',
      polygon: [{ x: -8, z: -8 }, { x: 8, z: -8 }, { x: 8, z: 8 }, { x: -8, z: 8 }],
      color: '#3d9be9',
      opacity: 0.32,
    };
    this.data.zones.push(zone);
    this.persistDraft();
    this.render();
    this.renderZoneEditor(zone);
  }

  deleteActiveZone() {
    if (this.data.zones.length <= 1) return;
    this.data.zones = this.data.zones.filter((zone) => zone.id !== this.activeZoneId);
    const next = this.data.zones[0];
    this.activeZoneId = next.id;
    this.persistDraft();
    this.render();
    this.renderZoneEditor(next);
  }

  addWall() {
    const id = this.uniqueId('inner-wall-new', this.data.walls);
    const wall = {
      id,
      type: 'inner',
      start: { x: -10, z: 0 },
      end: { x: 10, z: 0 },
      height: 2.6,
      thickness: 0.28,
    };
    this.data.walls.push(wall);
    this.persistDraft();
    this.render();
    this.renderWallEditor(wall);
  }

  deleteActiveWall() {
    if (this.data.walls.length <= 1) return;
    this.data.walls = this.data.walls.filter((wall) => wall.id !== this.activeWallId);
    const next = this.data.walls[0];
    this.activeWallId = next.id;
    this.persistDraft();
    this.render();
    this.renderWallEditor(next);
  }

  uniqueId(base, collection, currentId = null) {
    const normalized = String(base).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase() || 'item';
    if (currentId === normalized) return normalized;
    const ids = new Set(collection.map((item) => item.id).filter((id) => id !== currentId));
    if (!ids.has(normalized)) return normalized;
    let index = 2;
    while (ids.has(`${normalized}-${index}`)) index++;
    return `${normalized}-${index}`;
  }

  zoneBox(zone) {
    const xs = zone.polygon.map((point) => point.x);
    const zs = zone.polygon.map((point) => point.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ };
  }

  applyZoneBox(zone, box) {
    const left = box.x - box.width / 2;
    const right = box.x + box.width / 2;
    const top = box.z - box.depth / 2;
    const bottom = box.z + box.depth / 2;
    zone.polygon = [{ x: left, z: top }, { x: right, z: top }, { x: right, z: bottom }, { x: left, z: bottom }];
  }

  zoneCenter(zone) {
    const total = zone.polygon.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), { x: 0, z: 0 });
    return { x: total.x / zone.polygon.length, z: total.z / zone.polygon.length };
  }

  wallSegment(start, end, options) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = (-dz / length) * options.thickness / 2;
    const nz = (dx / length) * options.thickness / 2;
    return this.prism([
      { x: start.x + nx, z: start.z + nz },
      { x: end.x + nx, z: end.z + nz },
      { x: end.x - nx, z: end.z - nz },
      { x: start.x - nx, z: start.z - nz },
    ], options);
  }

  prism(points, { height, color, className, opacity = 1, y = 0 }) {
    const group = this.el('g', { class: className });
    const top = points.map((point) => this.project(point.x, point.z, y + height));
    group.appendChild(this.poly(top, color, opacity, 'top'));
    for (let index = 0; index < points.length; index++) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      group.appendChild(this.poly([
        this.project(a.x, a.z, y + height),
        this.project(b.x, b.z, y + height),
        this.project(b.x, b.z, y),
        this.project(a.x, a.z, y),
      ], color, opacity, index % 2 ? 'side' : 'front'));
    }
    return group;
  }

  box({ x, z, width, depth, height, color, className, opacity = 1, y = 0 }) {
    const left = x - width / 2;
    const right = x + width / 2;
    const top = z - depth / 2;
    const bottom = z + depth / 2;
    return this.prism([
      { x: left, z: top },
      { x: right, z: top },
      { x: right, z: bottom },
      { x: left, z: bottom },
    ], { height, color, className, opacity, y });
  }

  project(x, z, y = 0) {
    if (modelStage.classList.contains('top-view')) {
      return { x: this.centerX + x * this.scale, y: this.centerY + z * this.scale - y * this.scale * 0.2 };
    }
    return { x: this.centerX + (x - z) * this.scale, y: this.centerY + (x + z) * this.scale * 0.46 - y * this.scale * 1.7 };
  }

  poly(points, color, opacity, face) {
    return this.el('polygon', {
      points: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
      fill: color,
      opacity,
      class: `face face-${face}`,
    });
  }

  typeLabel(type) {
    return {
      office: '办公区',
      training: '会议/培训区',
      service: '设备/卫生间区',
      restricted: '重点/不可访问区',
      public: '公共区',
      'vertical-traffic': '楼梯/电梯/出入口',
    }[type] || type;
  }

  showTooltip(text) {
    this.tooltip.hidden = false;
    this.tooltip.textContent = text;
  }

  moveTooltip(event) {
    this.tooltip.style.left = `${event.clientX + 14}px`;
    this.tooltip.style.top = `${event.clientY + 14}px`;
  }

  hideTooltip() {
    this.tooltip.hidden = true;
  }

  getActiveZone() {
    return this.data.zones.find((zone) => zone.id === this.activeZoneId);
  }

  getActiveWall() {
    return this.data.walls.find((wall) => wall.id === this.activeWallId);
  }

  persistDraft() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  }

  loadDraft() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  resetDraft() {
    localStorage.removeItem(this.storageKey);
    this.data = this.clone(this.originalData);
    this.activeWallId = null;
    this.activeZoneId = this.data.zones[0].id;
    this.render();
    if (this.editMode) this.renderZoneEditor(this.data.zones[0]);
    else this.selectZone(this.data.zones[0]);
  }

  async copyCurrentJson() {
    const button = this.panel.querySelector('[data-editor-action="copy"]');
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.data, null, 2));
      button.textContent = '已复制';
    } catch {
      button.textContent = '复制失败';
    }
  }

  round(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  el(name, attrs = {}) {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
}
