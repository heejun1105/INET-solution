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
        // 객체 ID를 가져옴
        const objectId = object.dataset.id;
        if (!objectId) {
            console.warn('객체에 ID가 없습니다:', object);
            return;
        }
        
        // 이름박스를 찾음
        let nameBox = this.nameBoxes.get(objectId);
        
        // 이름박스가 없으면 생성
        if (!nameBox) {
            this.createOrUpdateNameBox(object);
            nameBox = this.nameBoxes.get(objectId);
            if (!nameBox) {
                console.warn('이름박스를 생성할 수 없습니다:', objectId);
                return;
            }
        }

        // 이미 이동 모드인지 확인
        const isAlreadyMovable = this.movableState.object === object;

        // 다른 객체가 이동 모드라면 해제
        if (this.movableState.object && this.movableState.object !== object) {
            this.disableMoveMode();
        }

        // 이동 모드 토글
        if (isAlreadyMovable) {
            this.disableMoveMode();
            console.log('이름박스 이동 모드 해제:', objectId);
        } else {
            this.movableState.object = object;
            nameBox.classList.add('movable');
            this.addResizeHandles(nameBox);
            console.log('이름박스 이동 모드 활성화:', objectId);
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
        if (!objectId) {
            console.warn('객체에 ID가 없습니다:', object);
            return;
        }
        
        console.log('이름박스 생성/업데이트 시작:', objectId, object.dataset.name);
        
        let nameBox = this.nameBoxes.get(objectId);

        if (!nameBox) {
            // 새 이름박스 생성
            nameBox = document.createElement('div');
            nameBox.className = 'name-box';
            object.appendChild(nameBox);
            this.nameBoxes.set(objectId, nameBox);

            // 이벤트 리스너 추가
            nameBox.addEventListener('mousedown', e => {
                if (this.movableState.object === object) {
                    this.startMoving(e, nameBox, object);
                }
                e.stopPropagation();
            });
            
            console.log('새 이름박스 생성 완료:', objectId);
        } else {
            console.log('기존 이름박스 사용:', objectId);
        }

        // 이름 업데이트
        const name = object.dataset.name || '';
        nameBox.textContent = name;
        
        // 이름이 있을 때만 표시
        nameBox.style.visibility = name ? 'visible' : 'hidden';
        console.log('이름박스 텍스트 설정:', name, '가시성:', nameBox.style.visibility);

        // 수동 위치 지정이 아니고, 이름박스 데이터가 없는 경우에만 중앙 정렬
        if (nameBox.dataset.positioned !== 'manual' && 
            (!this.movableState.object || this.movableState.object !== object) &&
            !object.nameBoxData) { // 이름박스 데이터가 없는 경우에만 중앙 정렬
            this.centerNameBox(nameBox);
            console.log('이름박스 중앙 정렬:', objectId);
        } else {
            console.log('이름박스 수동 위치 유지 또는 데이터 있음:', objectId);
        }
        
        return nameBox;
    }

    centerNameBox(nameBox) {
        nameBox.style.left = '50%';
        nameBox.style.top = '30%'; 
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
        
        // 미배치교실 배치 시 중앙 정렬 보호 플래그 해제 (사용자가 수동으로 이동할 때)
        delete nameBox.dataset.centeredForUnplaced;
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
    
    // FloorPlanManager에서 사용할 메서드들 추가
    getNameBoxForElement(element) {
        const objectId = element.dataset.id;
        return this.nameBoxes.get(objectId);
    }
    
    updateNameBoxPosition(element, x = null, y = null) {
        const nameBox = this.getNameBoxForElement(element);
        if (!nameBox) {
            console.warn(`이름박스를 찾을 수 없음: ${element.dataset.name}`);
            return;
        }
        
        // 미배치교실 배치 시 중앙 정렬 보호
        if (nameBox.dataset.centeredForUnplaced === 'true') {
            console.log(`미배치교실 이름박스 위치 변경 방지: ${element.dataset.name}`);
            return;
        }
        
        // null 값 체크 및 로깅
        if (x === null || y === null) {
            console.warn(`이름박스 위치 복원 실패 (null 값): ${element.dataset.name} -> x: ${x}, y: ${y}`);
            return;
        }
        // undefined 값 체크
        if (x === undefined || y === undefined) {
            console.warn(`이름박스 위치 복원 실패 (undefined 값): ${element.dataset.name} -> x: ${x}, y: ${y}`);
            return;
        }
        // 유효한 숫자인지 체크
        if (isNaN(x) || isNaN(y)) {
            console.warn(`이름박스 위치 복원 실패 (NaN 값): ${element.dataset.name} -> x: ${x}, y: ${y}`);
            return;
        }
        
        // 위치 설정
        nameBox.style.left = x + 'px';
        nameBox.style.top = y + 'px';
        nameBox.style.transform = ''; // transform 초기화 (중앙 정렬 제거)
        nameBox.dataset.positioned = 'manual';
        
        console.log(`이름박스 위치 복원 성공: ${element.dataset.name}`, { x, y });
    }
    
    updateNameBoxSize(element, width = null, height = null) {
        const nameBox = this.getNameBoxForElement(element);
        if (!nameBox) return;
        
        if (width !== null && height !== null) {
            nameBox.style.width = width + 'px';
            nameBox.style.height = height + 'px';
            
            // 크기 변경 후 폰트 크기 자동 조정 비활성화
            nameBox.dataset.fontSizeLocked = 'true';
            
            console.log(`이름박스 크기 복원: ${element.dataset.name}`, { width, height });
        } else if (width !== null) {
            nameBox.style.width = width + 'px';
            console.log(`이름박스 너비만 복원: ${element.dataset.name}`, { width });
        } else if (height !== null) {
            nameBox.style.height = height + 'px';
            console.log(`이름박스 높이만 복원: ${element.dataset.name}`, { height });
        }
    }
    
    updateNameBoxFontSize(element, fontSize = null) {
        const nameBox = this.getNameBoxForElement(element);
        if (!nameBox) return;
        
        if (fontSize !== null) {
            nameBox.style.fontSize = fontSize + 'px';
            // 폰트 크기 수동 설정 표시
            nameBox.dataset.fontSizeLocked = 'true';
        }
        
        console.log(`이름박스 폰트 크기 복원: ${element.dataset.name}`, { fontSize });
    }
    
    // 특정 요소의 이름박스를 중앙에 정렬
    centerNameBoxForElement(element) {
        const nameBox = this.getNameBoxForElement(element);
        if (!nameBox) return;
        
        // 기존 위치 및 크기 정보 제거
        nameBox.style.left = '';
        nameBox.style.top = '';
        nameBox.style.width = '';
        nameBox.style.height = '';
        nameBox.style.fontSize = '';
        nameBox.style.transform = '';
        
        // 중앙 정렬 적용
        this.centerNameBox(nameBox);
        
        // 수동 위치 설정 표시 제거 (자동 정렬로 복원)
        delete nameBox.dataset.positioned;
        delete nameBox.dataset.fontSizeLocked;
        
        // 미배치교실 배치 시 중앙 정렬 보호 플래그 설정
        nameBox.dataset.centeredForUnplaced = 'true';
        
        console.log(`이름박스 중앙 정렬: ${element.dataset.name}`);
        
        // 추가 보호: 0.5초 후에도 중앙 정렬 유지
        setTimeout(() => {
            if (nameBox.dataset.centeredForUnplaced === 'true') {
                this.centerNameBox(nameBox);
                console.log(`이름박스 중앙 정렬 유지: ${element.dataset.name}`);
            }
        }, 600);
    }
}