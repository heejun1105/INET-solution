export default class UnplacedRoomsManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.unplacedRooms = [];
        this.draggedRoom = null;
        this.isCollapsed = false; // 기본 상태를 펼쳐진 상태로 설정 (CSS와 일치)
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // 패널 토글 버튼
        document.getElementById('panelToggle').addEventListener('click', () => {
            this.togglePanel();
        });
        
        // 페이지 로드 시 패널을 닫힌 상태로 초기화
        const panel = document.getElementById('unplacedRoomsPanel');
        if (panel) {
            panel.classList.add('collapsed');
            this.isCollapsed = true;
            console.log('패널 초기화: 닫힌 상태로 설정됨');
        }
        
        // 캔버스 드롭 이벤트
        const canvas = document.getElementById('canvasContent');
        
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvas.classList.add('drag-over');
        });
        
        canvas.addEventListener('dragleave', (e) => {
            if (!canvas.contains(e.relatedTarget)) {
                canvas.classList.remove('drag-over');
            }
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            
            if (this.draggedRoom) {
                this.dropRoomOnCanvas(e);
            }
        });
    }
    
    togglePanel() {
        const panel = document.getElementById('unplacedRoomsPanel');
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            panel.classList.add('collapsed');
        } else {
            panel.classList.remove('collapsed');
        }
    }
    
    async loadUnplacedRooms(schoolId) {
        try {
            const response = await fetch(`/floorplan/api/unplaced-rooms/${schoolId}`);
            if (response.ok) {
                this.unplacedRooms = await response.json();
                this.renderUnplacedRooms();
            } else {
                console.error('미배치 교실 로딩 실패');
            }
        } catch (error) {
            console.error('미배치 교실 로딩 오류:', error);
            // 임시로 더미 데이터 사용
            this.loadDummyUnplacedRooms(schoolId);
        }
    }
    
    // 임시 더미 데이터 (실제 API가 없을 때)
    loadDummyUnplacedRooms(schoolId) {
        this.unplacedRooms = [
            { classroomId: 'temp1', roomName: '1-1교실', schoolId: schoolId },
            { classroomId: 'temp2', roomName: '1-2교실', schoolId: schoolId },
            { classroomId: 'temp3', roomName: '2-1교실', schoolId: schoolId },
            { classroomId: 'temp4', roomName: '2-2교실', schoolId: schoolId },
            { classroomId: 'temp5', roomName: '과학실', schoolId: schoolId },
            { classroomId: 'temp6', roomName: '음악실', schoolId: schoolId },
            { classroomId: 'temp7', roomName: '컴퓨터실', schoolId: schoolId }
        ];
        this.renderUnplacedRooms();
    }
    
    renderUnplacedRooms() {
        const container = document.getElementById('unplacedRoomsList');
        container.innerHTML = '';
        
        if (this.unplacedRooms.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">모든 교실이 배치되었습니다.</div>';
            return;
        }
        
        // 교실 이름에 따라 정렬 (한글 지원)
        const sortedRooms = [...this.unplacedRooms].sort((a, b) => {
            // 숫자-숫자 형식(예: 1-1) 패턴 추출
            const roomNumberPatternA = a.roomName.match(/(\d+)-(\d+)/);
            const roomNumberPatternB = b.roomName.match(/(\d+)-(\d+)/);
            
            if (roomNumberPatternA && roomNumberPatternB) {
                // 학년 비교
                const gradeA = parseInt(roomNumberPatternA[1]);
                const gradeB = parseInt(roomNumberPatternB[1]);
                
                if (gradeA !== gradeB) {
                    return gradeA - gradeB;
                }
                
                // 반 비교
                const classA = parseInt(roomNumberPatternA[2]);
                const classB = parseInt(roomNumberPatternB[2]);
                
                return classA - classB;
            }
            
            // 일반 텍스트 비교 (한글 지원)
            return a.roomName.localeCompare(b.roomName, 'ko');
        });
        
        sortedRooms.forEach(room => {
            const roomElement = this.createUnplacedRoomElement(room);
            container.appendChild(roomElement);
        });
    }
    
    createUnplacedRoomElement(room) {
        const element = document.createElement('div');
        element.className = 'unplaced-room-item';
        element.draggable = true;
        element.dataset.roomId = room.classroomId;
        
        element.innerHTML = `
            <div class="room-info">
                <div class="room-name">${room.roomName}</div>
                <div class="room-details">미배치 교실</div>
            </div>
            <div class="drag-icon">
                <i class="fas fa-grip-vertical"></i>
            </div>
        `;
        
        // 드래그 이벤트
        element.addEventListener('dragstart', (e) => {
            this.draggedRoom = room;
            element.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            this.draggedRoom = null;
        });
        
        return element;
    }
    
    dropRoomOnCanvas(e) {
        if (!this.draggedRoom) return;
        
        // 드래그 앤 드롭 시점에 캔버스 정보를 실시간으로 다시 계산
        const canvas = document.getElementById('canvasContent');
        
        // 드롭 시점에 캔버스 정보를 새로 가져옴 (기존 요소들의 영향 반영)
        const rect = canvas.getBoundingClientRect();
        
        // 현재 캔버스의 스크롤 상태 확인
        const canvasScrollLeft = canvas.scrollLeft || 0;
        const canvasScrollTop = canvas.scrollTop || 0;
        
        // 마우스 위치에서 캔버스 경계 빼기
        let rawX = e.clientX - rect.left;
        let rawY = e.clientY - rect.top;
        
        // 기존 요소 개수만 확인 (보정은 제거)
        const existingRooms = document.querySelectorAll('.room').length;
        console.log('📊 현재 캔버스에 있는 교실 개수:', existingRooms);
        
        // 캔버스 스크롤 보정
        rawX += canvasScrollLeft;
        rawY += canvasScrollTop;
        
        // 줌 레벨 적용
        const adjustedX = rawX / this.floorPlanManager.zoomManager.zoomLevel;
        const adjustedY = rawY / this.floorPlanManager.zoomManager.zoomLevel;
        
        // 마우스 위치를 그대로 사용 (중심 위치 조정은 createRoomOnCanvasWithCoords에서 처리)
        const finalRoomX = adjustedX;
        const finalRoomY = adjustedY;
        
        console.log('=== 드래그 앤 드롭 디버깅 (마진 제거) ===');
        console.log('원시 마우스 좌표:', { clientX: e.clientX, clientY: e.clientY });
        console.log('실시간 캔버스 경계:', { 
            left: rect.left, 
            top: rect.top, 
            width: rect.width, 
            height: rect.height 
        });
        console.log('캔버스 스크롤:', { left: canvasScrollLeft, top: canvasScrollTop });
        console.log('스크롤 보정 전 상대 좌표:', { x: e.clientX - rect.left, y: e.clientY - rect.top });
        console.log('스크롤 보정 후 좌표:', { rawX, rawY });
        console.log('줌 적용 좌표:', { adjustedX, adjustedY });
        console.log('최종 마우스 위치:', { roomX: finalRoomX, roomY: finalRoomY });
        console.log('줌 레벨:', this.floorPlanManager.zoomManager.zoomLevel);
        console.log('기존 요소 개수:', {
            buildings: document.querySelectorAll('.building').length,
            rooms: document.querySelectorAll('.room').length
        });
        console.log('📏 캔버스 실제 크기 및 상태:', {
            scrollSize: { width: canvas.scrollWidth, height: canvas.scrollHeight },
            clientSize: { width: canvas.clientWidth, height: canvas.clientHeight },
            offsetSize: { width: canvas.offsetWidth, height: canvas.offsetHeight },
            hasScrollbar: {
                horizontal: canvas.scrollWidth > canvas.clientWidth,
                vertical: canvas.scrollHeight > canvas.clientHeight
            },
            transform: canvas.style.transform || 'none'
        });
        
        // 좌표 유효성 검사
        if (finalRoomX < 0 || finalRoomY < 0) {
            console.warn('⚠️ 음수 좌표 감지! 최소값으로 조정합니다.', { finalRoomX, finalRoomY });
        }
        
        // 최소값 보정 (음수 방지)
        const correctedX = Math.max(0, finalRoomX);
        const correctedY = Math.max(0, finalRoomY);
        
        console.log('보정된 최종 좌표:', { correctedX, correctedY });
        
        // 실제 교실이 생성될 위치 계산 (마우스가 교실 중심이 되도록)
        const actualRoomX = correctedX - 50;
        const actualRoomY = correctedY - 40;
        
        // 마우스 위치에 파란색 마커 표시 (절대 위치) 
        const marker = document.createElement('div');
        marker.style.position = 'fixed';
        marker.style.left = (e.clientX - 5) + 'px'; // 마우스 절대 위치
        marker.style.top = (e.clientY - 5) + 'px';
        marker.style.width = '10px';
        marker.style.height = '10px';
        marker.style.background = 'blue';
        marker.style.borderRadius = '50%';
        marker.style.zIndex = '9999';
        marker.style.pointerEvents = 'none';
        marker.className = 'debug-marker';
        marker.title = '마우스 위치 (절대)';
        
        // 실제 교실이 생성될 위치에 빨간색 아웃라인 표시 (캔버스 내부)
        const roomOutline = document.createElement('div');
        roomOutline.style.position = 'absolute';
        roomOutline.style.left = actualRoomX + 'px';
        roomOutline.style.top = actualRoomY + 'px';
        roomOutline.style.width = '100px';
        roomOutline.style.height = '80px';
        roomOutline.style.border = '2px dashed red';
        roomOutline.style.background = 'rgba(255, 0, 0, 0.1)';
        roomOutline.style.zIndex = '9998';
        roomOutline.style.pointerEvents = 'none';
        roomOutline.className = 'debug-room-outline';
        roomOutline.title = '실제 교실 위치';
        
        console.log('🎯 디버그 마커 위치:', {
            마우스절대위치: { x: e.clientX, y: e.clientY },
            마우스캔버스위치: { x: correctedX, y: correctedY },
            실제교실위치: { x: actualRoomX, y: actualRoomY }
        });
        
        document.body.appendChild(marker); // 절대 위치 마커는 body에 추가
        canvas.appendChild(roomOutline); // 교실 아웃라인은 캔버스에 추가
        
        // 0.5초 후 마커들 제거
        setTimeout(() => {
            if (marker.parentNode) {
                marker.parentNode.removeChild(marker);
            }
            if (roomOutline.parentNode) {
                roomOutline.parentNode.removeChild(roomOutline);
            }
        }, 500);
        
        // 최종 좌표
        const finalX = correctedX;
        const finalY = correctedY;
        
        console.log('🎯 최종 생성 좌표 (중첩 허용):', {
            x: finalX,
            y: finalY
        });
        
        // 교실을 캔버스에 생성 (보정된 좌표로 직접 전달)
        console.log('🏫 교실 생성 시도 중...');
        console.log('📄 메서드 존재 확인:', {
            'createRoomOnCanvasWithCoords exists': typeof this.createRoomOnCanvasWithCoords === 'function',
            'this.draggedRoom': this.draggedRoom,
            'finalX': finalX,
            'finalY': finalY
        });
        
        try {
            if (typeof this.createRoomOnCanvasWithCoords === 'function') {
                this.createRoomOnCanvasWithCoords(this.draggedRoom, finalX, finalY);
                console.log('✅ 교실 생성 성공! (중첩 허용)');
            } else {
                console.error('❌ createRoomOnCanvasWithCoords 메서드가 없습니다! 대체 메서드 사용...');
                // 기존 메서드 호출
                this.createRoomOnCanvas(this.draggedRoom, finalX + 50, finalY + 40);
            }
        } catch (error) {
            console.error('❌ 교실 생성 실패:', error);
            console.error('Error stack:', error.stack);
        }
        
        // 미배치 목록에서 제거
        this.removeFromUnplacedList(this.draggedRoom.classroomId);
        
        this.floorPlanManager.showNotification(`${this.draggedRoom.roomName}이(가) 평면도에 배치되었습니다.`);
    }
    
    createRoomOnCanvas(roomData, x, y) {
        const canvas = document.getElementById('canvasContent');
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        let roomX = x - 50;
        let roomY = y - 40;
        // 경계 제한
        roomX = Math.max(0, Math.min(roomX, canvasWidth - 100));
        roomY = Math.max(0, Math.min(roomY, canvasHeight - 80));
        const roomInfo = {
            classroomId: roomData.classroomId,
            roomName: roomData.roomName,
            roomType: 'classroom',
            xCoordinate: roomX,
            yCoordinate: roomY,
            width: 100,
            height: 80,
            schoolId: roomData.schoolId
        };
        if (!this.floorPlanManager.floorPlanData.rooms) {
            this.floorPlanManager.floorPlanData.rooms = [];
        }
        this.floorPlanManager.floorPlanData.rooms.push(roomInfo);
        this.floorPlanManager.renderRoom(roomInfo);
    }
    
    // 이미 계산된 좌표를 직접 사용하는 메서드
    createRoomOnCanvasWithCoords(roomData, x, y) {
        const canvas = document.getElementById('canvasContent');
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        let roomX = x - 50;
        let roomY = y - 40;
        // 경계 제한
        roomX = Math.max(0, Math.min(roomX, canvasWidth - 100));
        roomY = Math.max(0, Math.min(roomY, canvasHeight - 80));
        const roomInfo = {
            classroomId: roomData.classroomId,
            roomName: roomData.roomName,
            roomType: 'classroom',
            xCoordinate: roomX,
            yCoordinate: roomY,
            width: 100,
            height: 80,
            schoolId: roomData.schoolId
        };
        if (!this.floorPlanManager.floorPlanData.rooms) {
            this.floorPlanManager.floorPlanData.rooms = [];
        }
        this.floorPlanManager.floorPlanData.rooms.push(roomInfo);
        // 이름 매개변수를 전달하여 수정된 메서드와 호환되도록 함
        this.floorPlanManager.renderRoom(roomInfo);
    }
    
    removeFromUnplacedList(roomId) {
        this.unplacedRooms = this.unplacedRooms.filter(room => room.classroomId !== roomId);
        this.renderUnplacedRooms();
    }
    
    // 교실이 평면도에서 제거될 때 미배치 목록에 다시 추가
    addToUnplacedList(roomData) {
        // 새교실 여부 확인
        const isNewRoom = 
            !roomData.classroomId || 
            roomData.classroomId === 'new' || 
            (roomData.classroomId && roomData.classroomId.toString().startsWith('temp_')) ||
            (roomData.roomName && roomData.roomName.includes('새 교실'));
        
        // 새교실은 미배치교실로 추가하지 않음
        if (isNewRoom) {
            console.log('새 교실은 미배치교실로 이동하지 않습니다:', roomData);
            return;
        }
        
        const unplacedRoom = {
            classroomId: roomData.classroomId || roomData.floorRoomId,
            roomName: roomData.roomName,
            schoolId: roomData.schoolId
        };
        
        // 이미 목록에 있는지 확인
        const exists = this.unplacedRooms.some(room => room.classroomId === unplacedRoom.classroomId);
        if (!exists) {
            this.unplacedRooms.push(unplacedRoom);
            
            // 미배치교실을 항상 펼쳐서 보이게 함
            const panel = document.getElementById('unplacedRoomsPanel');
            if (panel && this.isCollapsed) {
                this.togglePanel(); // 패널이 접혀있으면 펼침
            }
            
            this.renderUnplacedRooms(); // 정렬된 상태로 다시 렌더링
        }
    }
} 