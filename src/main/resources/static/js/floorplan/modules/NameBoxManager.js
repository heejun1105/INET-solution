export default class NameBoxManager {
    constructor(floorPlan, zoomManager) {
        this.floorPlan = floorPlan;
        this.zoomManager = zoomManager;
        this.nameBoxes = new Map();
        
        this.movableState = { object: null };
        this.movingState = { active: false, nameBox: null, offsetX: 0, offsetY: 0 };
        this.resizingState = { active: false, nameBox: null, startX: 0, startY: 0, startW: 0, startH: 0 };

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.stopActions = this.stopActions.bind(this);

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.stopActions);
        
        this.addStyles();
    }

    toggleMoveMode(object) {
        const nameBox = this.nameBoxes.get(object.dataset.id);
        if (!nameBox) return;

        const isAlreadyMovable = this.movableState.object === object;

        if (this.movableState.object) {
            this.disableMoveMode();
        }

        if (!isAlreadyMovable) {
            this.movableState.object = object;
            nameBox.classList.add('movable');
            this.addResizeHandles(nameBox);
        }
    }

    disableMoveMode() {
        if (!this.movableState.object) return;
        const nameBox = this.nameBoxes.get(this.movableState.object.dataset.id);
        if (nameBox) {
            nameBox.classList.remove('movable');
            this.removeResizeHandles(nameBox);
        }
        this.movableState.object = null;
    }

    createOrUpdateNameBox(object) {
        const objectId = object.dataset.id;
        let nameBox = this.nameBoxes.get(objectId);

        if (!nameBox) {
            nameBox = document.createElement('div');
            nameBox.className = 'name-box';
            object.appendChild(nameBox);
            this.nameBoxes.set(objectId, nameBox);

            nameBox.addEventListener('mousedown', e => {
                if (this.movableState.object === object) {
                    this.startMoving(e, nameBox, object);
                }
                e.stopPropagation();
            });
        }

        nameBox.textContent = object.dataset.name || '';

        if (nameBox.dataset.positioned !== 'manual' && (!this.movableState.object || this.movableState.object !== object)) {
            this.centerNameBox(nameBox);
        }
        
        nameBox.style.visibility = object.dataset.name ? 'visible' : 'hidden';
    }

    centerNameBox(nameBox) {
        nameBox.style.left = '50%';
        nameBox.style.top = '50%';
        nameBox.style.width = ''; 
        nameBox.style.height = '';
        nameBox.style.fontSize = ''; // 폰트 크기 초기화 (CSS 기본값 적용)
        nameBox.style.transform = 'translate(-50%, -50%)';
        nameBox.dataset.positioned = 'auto';
    }

    startMoving(event, nameBox, object) {
        event.preventDefault();
        this.movingState.active = true;
        this.movingState.nameBox = nameBox;

        const nameBoxRect = nameBox.getBoundingClientRect();
        const scale = this.zoomManager.getCurrentZoom();
        
        this.movingState.offsetX = (event.clientX - nameBoxRect.left) / scale;
        this.movingState.offsetY = (event.clientY - nameBoxRect.top) / scale;

        nameBox.style.transform = '';
        nameBox.dataset.positioned = 'manual';
    }
    
    stopActions() {
        if (this.movingState.active) {
            this.movingState.active = false;
        }
        if (this.resizingState.active) {
            this.resizingState.active = false;
        }
    }

    handleMouseMove(e) {
        if (this.movingState.active) {
            const { nameBox, offsetX, offsetY } = this.movingState;
            const object = nameBox.parentElement;
            const parentRect = object.getBoundingClientRect();
            const scale = this.zoomManager.getCurrentZoom();
            const mouseX = (e.clientX - parentRect.left) / scale;
            const mouseY = (e.clientY - parentRect.top) / scale;

            let newLeft = mouseX - offsetX;
            let newTop = mouseY - offsetY;

            const minLeft = 0;
            const maxLeft = object.clientWidth - nameBox.offsetWidth;
            const minTop = 0;
            const maxTop = object.clientHeight - nameBox.offsetHeight;

            newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
            newTop = Math.max(minTop, Math.min(newTop, maxTop));
            
            nameBox.style.left = `${newLeft}px`;
            nameBox.style.top = `${newTop}px`;
        } else if (this.resizingState.active) {
            const { nameBox, startX, startY, startW, startH } = this.resizingState;
            const scale = this.zoomManager.getCurrentZoom();
            const deltaX = (e.clientX - startX) / scale;
            const deltaY = (e.clientY - startY) / scale;
            
            const newWidth = Math.max(30, startW + deltaX);
            const newHeight = Math.max(20, startH + deltaY);

            nameBox.style.width = newWidth + 'px';
            nameBox.style.height = newHeight + 'px';

            this._adjustFontSize(nameBox);
        }
    }

    _adjustFontSize(nameBox) {
        const MIN_FONT_SIZE = 8;
        // 높이의 60%를 폰트 크기로 사용하되, 최소 크기 보장
        const newSize = Math.max(MIN_FONT_SIZE, nameBox.offsetHeight * 0.6);
        nameBox.style.fontSize = `${newSize}px`;
    }

    addResizeHandles(nameBox) {
        const handle = document.createElement('div');
        handle.className = 'name-box-resize-handle se';
        nameBox.appendChild(handle);

        handle.addEventListener('mousedown', e => {
            e.stopPropagation();
            this.startResizing(e, nameBox);
        });
    }

    removeResizeHandles(nameBox) {
        const handle = nameBox.querySelector('.name-box-resize-handle');
        if (handle) handle.remove();
    }
    
    startResizing(e, nameBox) {
        e.preventDefault();
        this.resizingState.active = true;
        this.resizingState.nameBox = nameBox;
        this.resizingState.startX = e.clientX;
        this.resizingState.startY = e.clientY;
        this.resizingState.startW = nameBox.offsetWidth;
        this.resizingState.startH = nameBox.offsetHeight;
        nameBox.style.transform = ''; // 크기 조절 시 transform 방해 방지
    }
    
    addStyles() {
        const styleId = 'name-box-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .name-box { 
                position: absolute;
                padding: 4px 8px;
                background-color: rgba(240, 240, 240, 0.85);
                border-radius: 4px;
                white-space: nowrap;
                transition: box-shadow 0.2s, background-color 0.2s, border-color 0.2s;
                pointer-events: auto;
                z-index: 1000;
                border: 1px dashed transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                font-size: 14px; /* 기본 폰트 크기 */
            }
            .name-box.movable { 
                border-color: #3b82f6;
                cursor: grab;
            }
            .name-box.movable:active {
                cursor: grabbing;
            }
            .name-box-resize-handle {
                position: absolute;
                width: 10px;
                height: 10px;
                background: #3b82f6;
                border: 1px solid #fff;
                border-radius: 50%;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .name-box.movable .name-box-resize-handle {
                opacity: 1;
            }
            .name-box-resize-handle.se {
                bottom: -5px;
                right: -5px;
                cursor: se-resize;
            }
        `;
        document.head.appendChild(style);
    }
}