export default class UnplacedRoomsManager {
    constructor(floorPlanManager) {
        this.floorPlanManager = floorPlanManager;
        this.unplacedRooms = [];
        this.draggedRoom = null;
        this.isCollapsed = false; // 기본 상태를 펼쳐진 상태로 설정 (CSS와 일치)
        
        // 메모리 풀링 시스템 추가
        this.elementPool = [];
        this.maxPoolSize = 50; // 최대 풀 크기
        
        this.initEventListeners();
    }
    
    // 메모리 풀에서 요소 가져오기
    getElementFromPool() {
        if (this.elementPool.length > 0) {
            return this.elementPool.pop();
        }
        return null;
    }
    
    // 메모리 풀에 요소 반환
    returnElementToPool(element) {
        if (this.elementPool.length < this.maxPoolSize) {
            // 요소 초기화
            element.innerHTML = '';
            element.className = 'unplaced-room-item';
            element.removeAttribute('data-room-id');
            element.removeAttribute('data-recently-added');
            element.removeAttribute('draggable');
            
            // 이벤트 리스너 제거
            element.removeEventListener('dragstart', null);
            element.removeEventListener('dragend', null);
            
            this.elementPool.push(element);
        }
    }
    
    // 메모리 풀 정리
    clearElementPool() {
        this.elementPool.length = 0;
    }
    
    initEventListeners() {
        // 패널 토글 버튼
        const panelToggle = document.getElementById('panelToggle');
        if (panelToggle) {
            panelToggle.addEventListener('click', () => {
                this.togglePanel();
            });
        }
        
        // 페이지 로드 시 패널을 닫힌 상태로 초기화
        const panel = document.getElementById('unplacedRoomsPanel');
        if (panel) {
            panel.classList.add('collapsed');
            this.isCollapsed = true;
            console.log('패널 초기화: 닫힌 상태로 설정됨');
        }
        
        // 캔버스 드롭 이벤트
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            console.warn('캔버스 요소를 찾을 수 없습니다.');
            return;
        }
        
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
            console.log('미배치교실 로딩 시작:', schoolId);
            
            // 항상 기본 미배치 교실 데이터를 먼저 로드
            await this.loadDefaultUnplacedRooms(schoolId);
            
            // 잠시 대기 후 평면도 데이터 확인 (평면도 로드 완료 대기)
            setTimeout(async () => {
                await this.syncWithFloorPlan(schoolId);
            }, 500);
            
        } catch (error) {
            console.error('미배치 교실 로딩 오류:', error);
            // 오류 발생 시에도 기본 데이터는 로드되어 있음
        }
    }
    
    // 기본 미배치 교실 데이터 로드
    async loadDefaultUnplacedRooms(schoolId) {
        try {
            // 기존 API에서 교실 목록 가져오기
            const response = await fetch(`/classroom/api/school/${schoolId}/classrooms`);
            if (response.ok) {
                const classrooms = await response.json();
                this.unplacedRooms = classrooms.map(classroom => ({
                    classroomId: classroom.classroomId,
                    roomName: classroom.roomName,
                    schoolId: schoolId
                }));
            } else {
                // API 실패 시 더미 데이터 사용
                this.loadDummyUnplacedRooms(schoolId);
            }
        } catch (error) {
            console.error('기본 교실 데이터 로딩 오류:', error);
            this.loadDummyUnplacedRooms(schoolId);
        }
        this.renderUnplacedRooms();
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
        if (!container) {
            console.warn('unplacedRoomsList 요소를 찾을 수 없습니다.');
            return;
        }
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
        
        // 가상화 적용: 화면에 보이는 것만 렌더링 (최대 20개)
        const maxVisibleItems = 20;
        const visibleRooms = sortedRooms.slice(0, maxVisibleItems);
        
        // DocumentFragment를 사용하여 성능 최적화
        const fragment = document.createDocumentFragment();
        
        visibleRooms.forEach((room, index) => {
            const roomElement = this.createUnplacedRoomElement(room);
            
            // 새로 추가된 교실인지 확인 (data-recently-added 속성으로)
            if (roomElement.dataset.recentlyAdded === 'true') {
                roomElement.style.animation = 'slideInFromRight 0.5s ease-out';
                roomElement.style.backgroundColor = '#e8f5e9';
                roomElement.style.borderLeft = '4px solid #4caf50';
                
                // 애니메이션 완료 후 스타일 제거
                setTimeout(() => {
                    roomElement.style.animation = '';
                    roomElement.style.backgroundColor = '';
                    roomElement.style.borderLeft = '';
                    roomElement.dataset.recentlyAdded = 'false';
                }, 2000);
            }
            
            fragment.appendChild(roomElement);
        });
        
        // 더 많은 교실이 있는 경우 표시
        if (sortedRooms.length > maxVisibleItems) {
            const moreIndicator = document.createElement('div');
            moreIndicator.style.textAlign = 'center';
            moreIndicator.style.color = '#666';
            moreIndicator.style.padding = '10px';
            moreIndicator.style.fontSize = '12px';
            moreIndicator.textContent = `... 외 ${sortedRooms.length - maxVisibleItems}개 더`;
            fragment.appendChild(moreIndicator);
        }
        
        // requestAnimationFrame을 사용하여 DOM 변경 최적화
        requestAnimationFrame(() => {
            container.appendChild(fragment);
        });
    }
    
    createUnplacedRoomElement(room) {
        // 메모리 풀에서 요소 재사용 시도
        let element = this.getElementFromPool();
        
        if (!element) {
            // 풀에 요소가 없으면 새로 생성
            element = document.createElement('div');
        }
        
        element.className = 'unplaced-room-item';
        element.draggable = true;
        element.dataset.roomId = room.classroomId;
        
        // 새로 추가된 교실인지 확인
        if (room.recentlyAdded) {
            element.dataset.recentlyAdded = 'true';
        }
        
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
        
        // ZoomManager의 좌표 계산 메서드를 사용하여 정확한 캔버스 좌표 계산
        const canvasCoords = this.floorPlanManager.zoomManager.getCanvasCoordinates(e);
        
        console.log('=== 드래그 앤 드롭 디버깅 (ZoomManager 사용) ===');
        console.log('원시 마우스 좌표:', { clientX: e.clientX, clientY: e.clientY });
        console.log('ZoomManager 계산 좌표:', canvasCoords);
        console.log('줌 레벨:', this.floorPlanManager.zoomManager.zoomLevel);
        
        // 좌표 유효성 검사
        if (canvasCoords.x < 0 || canvasCoords.y < 0) {
            console.warn('⚠️ 음수 좌표 감지! 최소값으로 조정합니다.', canvasCoords);
        }
        
        // 최소값 보정 (음수 방지)
        const correctedX = Math.max(0, canvasCoords.x);
        const correctedY = Math.max(0, canvasCoords.y);
        
        console.log('보정된 최종 좌표:', { correctedX, correctedY });
        
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
        roomOutline.style.left = correctedX + 'px';
        roomOutline.style.top = correctedY + 'px';
        roomOutline.style.width = '120px';
        roomOutline.style.height = '105px';
        roomOutline.style.border = '2px dashed red';
        roomOutline.style.background = 'rgba(255, 0, 0, 0.1)';
        roomOutline.style.zIndex = '9998';
        roomOutline.style.pointerEvents = 'none';
        roomOutline.className = 'debug-room-outline';
        roomOutline.title = '실제 교실 위치';
        
        console.log('🎯 디버그 마커 위치:', {
            마우스절대위치: { x: e.clientX, y: e.clientY },
            캔버스좌표: { x: correctedX, y: correctedY }
        });
        
        document.body.appendChild(marker); // 절대 위치 마커는 body에 추가
        document.getElementById('canvasContent').appendChild(roomOutline); // 교실 아웃라인은 캔버스에 추가
        
        // 0.5초 후 마커들 제거
        setTimeout(() => {
            if (marker.parentNode) {
                marker.parentNode.removeChild(marker);
            }
            if (roomOutline.parentNode) {
                roomOutline.parentNode.removeChild(roomOutline);
            }
        }, 500);
        
        console.log('🎯 최종 생성 좌표:', {
            x: correctedX,
            y: correctedY
        });
        
        // 교실을 캔버스에 생성 (보정된 좌표로 직접 전달)
        console.log('🏫 교실 생성 시도 중...');
        console.log('📄 메서드 존재 확인:', {
            'createRoomOnCanvasWithCoords exists': typeof this.createRoomOnCanvasWithCoords === 'function',
            'this.draggedRoom': this.draggedRoom,
            'correctedX': correctedX,
            'correctedY': correctedY
        });
        
        try {
            if (typeof this.createRoomOnCanvasWithCoords === 'function') {
                this.createRoomOnCanvasWithCoords(this.draggedRoom, correctedX, correctedY);
                console.log('✅ 교실 생성 성공!');
            } else {
                console.error('❌ createRoomOnCanvasWithCoords 메서드가 없습니다! 대체 메서드 사용...');
                // 기존 메서드 호출
                this.createRoomOnCanvas(this.draggedRoom, correctedX + 60, correctedY + 52.5);
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
        console.log('미배치교실 배치 데이터:', roomData);
        if (roomData.nameBoxData) {
            console.log('미배치교실 배치 시 이름박스 데이터 확인:', roomData.nameBoxData);
        }
        
        // 캔버스 좌표로 변환 (오프셋 제거 - createRoom에서 처리)
        const roomX = x;
        const roomY = y;
        
        const roomInfo = {
            classroomId: roomData.classroomId,
            roomName: roomData.roomName,
            roomType: 'classroom',
            xCoordinate: roomX,
            yCoordinate: roomY,
            width: 120,
            height: 105,
            schoolId: roomData.schoolId,
            nameBoxData: roomData.nameBoxData || null, // 보존된 이름박스 데이터 전달
            nameBoxX: roomData.nameBoxData ? undefined : undefined, // nameBoxData가 있으면 개별 필드는 undefined
            nameBoxY: roomData.nameBoxData ? undefined : undefined,
            nameBoxWidth: roomData.nameBoxData ? undefined : undefined,
            nameBoxHeight: roomData.nameBoxData ? undefined : undefined,
            nameBoxFontSize: roomData.nameBoxData ? undefined : undefined
        };
        
        console.log('미배치교실 배치 데이터:', roomInfo);
        if (roomData.nameBoxData) {
            console.log('미배치교실 배치 시 이름박스 데이터 확인:', roomData.nameBoxData);
        }
        
        const roomElement = this.floorPlanManager.renderRoom(roomInfo);
        
        // 이름박스 데이터가 없는 경우에만 중앙 정렬
        if (!roomData.nameBoxData) {
            setTimeout(() => {
                if (roomElement) {
                    this.floorPlanManager.nameBoxManager.centerNameBoxForElement(roomElement);
                    console.log(`미배치교실 배치 완료: ${roomData.roomName} - 이름박스 중앙 정렬됨`);
                }
            }, 100);
        } else {
            console.log(`미배치교실 배치 완료: ${roomData.roomName} - 보존된 이름박스 데이터 사용`);
        }
        
        // 미배치교실 목록에서 제거
        this.removeFromUnplacedList(roomData.classroomId);
        console.log(`미배치교실 목록에서 제거됨: ${roomData.roomName} (ID: ${roomData.classroomId})`);
    }
    
    createRoomOnCanvasWithCoords(roomData, x, y) {
        console.log('미배치교실 배치 데이터 (좌표):', roomData);
        if (roomData.nameBoxData) {
            console.log('미배치교실 배치 시 이름박스 데이터 확인 (좌표):', roomData.nameBoxData);
        }
        
        const roomInfo = {
            classroomId: roomData.classroomId,
            roomName: roomData.roomName,
            roomType: 'classroom',
            xCoordinate: x,
            yCoordinate: y,
            width: 120,
            height: 105,
            schoolId: roomData.schoolId,
            nameBoxData: roomData.nameBoxData || null, // 보존된 이름박스 데이터 전달
            nameBoxX: roomData.nameBoxData ? undefined : undefined, // nameBoxData가 있으면 개별 필드는 undefined
            nameBoxY: roomData.nameBoxData ? undefined : undefined,
            nameBoxWidth: roomData.nameBoxData ? undefined : undefined,
            nameBoxHeight: roomData.nameBoxData ? undefined : undefined,
            nameBoxFontSize: roomData.nameBoxData ? undefined : undefined
        };
        
        console.log('미배치교실 배치 데이터 (좌표):', roomInfo);
        if (roomData.nameBoxData) {
            console.log('미배치교실 배치 시 이름박스 데이터 확인 (좌표):', roomData.nameBoxData);
        }
        
        const roomElement = this.floorPlanManager.renderRoom(roomInfo);
        
        // 이름박스 데이터가 없는 경우에만 중앙 정렬
        if (!roomData.nameBoxData) {
            setTimeout(() => {
                if (roomElement) {
                    this.floorPlanManager.nameBoxManager.centerNameBoxForElement(roomElement);
                    console.log(`미배치교실 배치 완료 (좌표): ${roomData.roomName} - 이름박스 중앙 정렬됨`);
                }
            }, 100);
        } else {
            console.log(`미배치교실 배치 완료 (좌표): ${roomData.roomName} - 보존된 이름박스 데이터 사용`);
        }
        
        // 미배치교실 목록에서 제거
        this.removeFromUnplacedList(roomData.classroomId);
        console.log(`미배치교실 목록에서 제거됨 (좌표): ${roomData.roomName} (ID: ${roomData.classroomId})`);
    }
    
    // 평면도와 동기화하는 별도 메서드
    async syncWithFloorPlan(schoolId) {
        try {
            console.log('평면도와 미배치교실 목록 동기화 시작');
            
            // 현재 DOM에서 배치된 교실 요소들 직접 확인
            const canvas = document.getElementById('canvasContent');
            if (!canvas) {
                console.log('캔버스를 찾을 수 없습니다.');
                return;
            }
            
            const roomElements = canvas.querySelectorAll('.room');
            console.log('DOM에서 찾은 교실 요소 개수:', roomElements.length);
            
                    // 배치된 교실들의 ID 수집 (중복 방지를 위해 Set 사용)
                    const placedRoomIdsSet = new Set();
                    
            roomElements.forEach(element => {
                const classroomId = element.dataset.classroomId;
                if (classroomId && !classroomId.toString().startsWith('temp_')) {
                    placedRoomIdsSet.add(classroomId.toString()); // 문자열로 변환
                    console.log('DOM에서 배치된 교실 발견:', classroomId, element.dataset.name);
                }
            });
                    
                    const placedRoomIds = Array.from(placedRoomIdsSet);
            console.log('DOM에서 배치된 교실 ID 목록:', placedRoomIds);
                    console.log('현재 미배치교실 목록:', this.unplacedRooms.map(r => ({ 
                        id: r.classroomId, 
                        name: r.roomName,
                        idType: typeof r.classroomId 
                    })));
                    
                    // 배치된 교실들을 미배치 목록에서 제거
                    if (placedRoomIds.length > 0) {
                        const beforeCount = this.unplacedRooms.length;
                        
                        // ID 타입을 일치시켜서 필터링
                        this.unplacedRooms = this.unplacedRooms.filter(room => {
                            const roomIdStr = room.classroomId.toString();
                            const shouldRemove = placedRoomIds.includes(roomIdStr);
                            if (shouldRemove) {
                                console.log(`미배치교실 목록에서 제거됨: ${room.roomName} (ID: ${room.classroomId})`);
                            }
                            return !shouldRemove;
                        });
                        
                        const afterCount = this.unplacedRooms.length;
                        
                        console.log(`미배치교실 목록에서 ${beforeCount - afterCount}개 교실 제거됨 (${beforeCount} -> ${afterCount})`);
                        this.renderUnplacedRooms();
                    } else {
                console.log('DOM에서 배치된 교실이 없습니다.');
            }
            
        } catch (error) {
            console.error('평면도 동기화 오류:', error);
        }
    }
    
    removeFromUnplacedList(roomId) {
        console.log('미배치교실 목록에서 제거 시도:', roomId);
        console.log('제거 전 미배치교실 목록:', this.unplacedRooms.map(r => ({ 
            id: r.classroomId, 
            name: r.roomName,
            idType: typeof r.classroomId 
        })));
        
        const beforeCount = this.unplacedRooms.length;
        // ID 타입을 일치시켜서 제거
        this.unplacedRooms = this.unplacedRooms.filter(room => {
            const roomIdStr = room.classroomId.toString();
            const targetIdStr = roomId.toString();
            return roomIdStr !== targetIdStr;
        });
        const afterCount = this.unplacedRooms.length;
        
        if (beforeCount !== afterCount) {
            console.log(`미배치교실 목록에서 제거 완료: ${roomId} (${beforeCount} -> ${afterCount})`);
            
            // 이벤트 리스너 정리 - DOM에서 해당 요소 제거
            const container = document.getElementById('unplacedRoomsList');
            const roomElement = container.querySelector(`[data-room-id="${roomId}"]`);
            if (roomElement) {
                // 메모리 풀에 요소 반환
                this.returnElementToPool(roomElement);
                console.log('메모리 풀에 요소 반환 완료:', roomId);
            }
        } else {
            console.warn(`미배치교실 목록에서 제거 실패: ${roomId} (찾을 수 없음)`);
            // 디버깅을 위해 ID 타입 출력
            console.log('제거 시도한 ID 타입:', typeof roomId, '값:', roomId);
            console.log('미배치교실 목록의 ID들:', this.unplacedRooms.map(r => ({
                id: r.classroomId,
                type: typeof r.classroomId,
                name: r.roomName
            })));
        }
        
        this.renderUnplacedRooms();
    }
    
    // 평면도에 배치된 교실들을 미배치교실 목록에서 제거
    removePlacedRooms(placedRoomIds) {
        if (!Array.isArray(placedRoomIds) || placedRoomIds.length === 0) {
            console.log('제거할 배치된 교실이 없습니다.');
            return;
        }
        
        console.log('미배치교실 목록에서 배치된 교실들 제거 시작:', placedRoomIds);
        console.log('제거 전 미배치교실 목록:', this.unplacedRooms.map(r => ({ id: r.classroomId, name: r.roomName })));
        
        const beforeCount = this.unplacedRooms.length;
        this.unplacedRooms = this.unplacedRooms.filter(room => !placedRoomIds.includes(room.classroomId));
        const afterCount = this.unplacedRooms.length;
        
        const removedCount = beforeCount - afterCount;
        console.log(`미배치교실 목록에서 ${removedCount}개 교실 제거 완료 (${beforeCount} -> ${afterCount})`);
        
        if (removedCount > 0) {
            console.log('제거된 교실들:', placedRoomIds.filter(id => 
                this.unplacedRooms.every(room => room.classroomId !== id)
            ));
        }
        
        this.renderUnplacedRooms();
    }
    
    // 교실이 평면도에서 제거될 때 미배치 목록에 다시 추가
    addToUnplacedList(roomData) {
        console.log('미배치 교실로 이동 시도:', roomData);
        
        // 새교실 여부 확인 (임시 ID나 새 교실명 포함)
        const isNewRoom = 
            !roomData.classroomId || 
            roomData.classroomId === 'new' || 
            (roomData.classroomId && roomData.classroomId.toString().startsWith('temp_')) ||
            (roomData.roomName && roomData.roomName.includes('새 교실')) ||
            (roomData.floorRoomId && roomData.floorRoomId.toString().startsWith('temp_'));
        
        // 새교실은 미배치교실로 추가하지 않음
        if (isNewRoom) {
            console.log('새 교실은 미배치교실로 이동하지 않습니다:', roomData);
            return;
        }
        
        // 교실 데이터 정규화
        const unplacedRoom = {
            classroomId: roomData.classroomId || roomData.floorRoomId,
            roomName: roomData.roomName || roomData.buildingName || '알 수 없는 교실',
            schoolId: roomData.schoolId || this.floorPlanManager.currentSchoolId,
            // 이름박스 데이터 보존
            nameBoxData: roomData.nameBoxData || null
        };
        
        // 이름박스 데이터가 있으면 로그 출력
        if (unplacedRoom.nameBoxData) {
            console.log('미배치교실로 이동 시 이름박스 데이터 보존:', unplacedRoom.nameBoxData);
        }
        
        // 필수 데이터 검증
        if (!unplacedRoom.classroomId || !unplacedRoom.roomName) {
            console.warn('교실 데이터가 불완전하여 미배치 교실로 이동할 수 없습니다:', roomData);
            return;
        }
        
        // 이미 목록에 있는지 확인
        const exists = this.unplacedRooms.some(room => 
            room.classroomId === unplacedRoom.classroomId || 
            room.roomName === unplacedRoom.roomName
        );
        
        if (!exists) {
            // 새로 추가된 교실임을 표시
            unplacedRoom.recentlyAdded = true;
            this.unplacedRooms.push(unplacedRoom);
            
            // 미배치교실을 항상 펼쳐서 보이게 함
            const panel = document.getElementById('unplacedRoomsPanel');
            if (panel && this.isCollapsed) {
                this.togglePanel(); // 패널이 접혀있으면 펼침
            }
            
            // 교실명으로 정렬
            this.unplacedRooms.sort((a, b) => a.roomName.localeCompare(b.roomName));
            
            this.renderUnplacedRooms(); // 정렬된 상태로 다시 렌더링
            
            console.log(`"${unplacedRoom.roomName}" 교실이 미배치 교실 목록에 추가되었습니다.`);
        } else {
            // 기존 항목이 있으면 이름박스 데이터 업데이트
            const existingRoom = this.unplacedRooms.find(room => 
                room.classroomId === unplacedRoom.classroomId || 
                room.roomName === unplacedRoom.roomName
            );
            if (existingRoom && unplacedRoom.nameBoxData) {
                existingRoom.nameBoxData = unplacedRoom.nameBoxData;
                console.log(`"${unplacedRoom.roomName}" 교실의 이름박스 데이터 업데이트됨`);
            }
            console.log(`"${unplacedRoom.roomName}" 교실은 이미 미배치 교실 목록에 있습니다.`);
        }
    }
} 