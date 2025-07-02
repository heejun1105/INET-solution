/**
 * 교실 상세 모달 관리
 * 교실 내부 레이아웃, 장비 배치, 자리 관리 기능
 */

class ClassroomModal {
    constructor() {
        this.currentClassroomId = null;
        this.currentRoomData = null;
        this.isEditMode = false;
        this.seats = [];
        this.deviceLocations = [];
        this.selectedSeat = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        // 교실 클릭 이벤트 (부모 클래스에서 호출)
        document.addEventListener('classroomClicked', (event) => {
            this.openModal(event.detail.classroomId, event.detail.roomData);
        });
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalOpen()) {
                this.closeModal();
            }
        });
    }
    
    async openModal(classroomId, roomData) {
        this.currentClassroomId = classroomId;
        this.currentRoomData = roomData;
        
        // 모달 표시
        document.getElementById('classroomDetailModal').style.display = 'flex';
        
        // 기본 정보 표시
        this.displayClassroomInfo(roomData);
        
        // 장비 목록 로드
        await this.loadDevices();
        
        // 자리 목록 로드
        await this.loadSeats();
        
        // 교실 레이아웃 렌더링
        this.renderRoomLayout();
    }
    
    closeModal() {
        document.getElementById('classroomDetailModal').style.display = 'none';
        this.currentClassroomId = null;
        this.currentRoomData = null;
        this.isEditMode = false;
        this.selectedSeat = null;
        
        // 캔버스 초기화
        this.clearRoomCanvas();
    }
    
    isModalOpen() {
        const modal = document.getElementById('classroomDetailModal');
        return modal && modal.style.display === 'flex';
    }
    
    displayClassroomInfo(roomData) {
        document.getElementById('classroomModalTitle').textContent = 
            `${roomData.roomName || '교실'} 상세 정보`;
        document.getElementById('classroomName').textContent = 
            roomData.roomName || '-';
        document.getElementById('classroomBuilding').textContent = 
            roomData.buildingName || '-';
        document.getElementById('classroomFloor').textContent = 
            roomData.floorName || '-';
        document.getElementById('classroomType').textContent = 
            this.getRoomTypeLabel(roomData.roomType) || '교실';
    }
    
    getRoomTypeLabel(roomType) {
        const typeMap = {
            'classroom': '교실',
            'restroom': '화장실',
            'stairs': '계단',
            'entrance': '현관',
            'office': '사무실',
            'laboratory': '실험실',
            'library': '도서관'
        };
        
        return typeMap[roomType] || roomType || '교실';
    }
    
    async loadDevices() {
        try {
            const response = await fetch(`/floorplan/api/room/${this.currentClassroomId}/devices`);
            if (response.ok) {
                const deviceCounts = await response.json();
                this.displayDevices(deviceCounts);
            }
        } catch (error) {
            console.error('장비 정보 로딩 오류:', error);
            this.showError('장비 정보를 불러오는데 실패했습니다.');
        }
    }
    
    displayDevices(deviceCounts) {
        const devicesList = document.getElementById('devicesList');
        const countBadge = document.getElementById('deviceCountBadge');
        
        // 총 개수 업데이트
        const totalCount = Object.values(deviceCounts).reduce((sum, count) => sum + count, 0);
        countBadge.textContent = totalCount;
        
        // 장비 목록 표시
        devicesList.innerHTML = '';
        
        if (totalCount === 0) {
            devicesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: #64748b;">배치된 장비가 없습니다.</p>
                </div>
            `;
            return;
        }
        
        Object.entries(deviceCounts).forEach(([type, count]) => {
            if (count > 0) {
                const deviceItem = this.createDeviceItem(type, count);
                devicesList.appendChild(deviceItem);
            }
        });
    }
    
    createDeviceItem(type, count) {
        const item = document.createElement('div');
        item.className = 'device-item';
        
        const icon = this.getDeviceIcon(type);
        
        item.innerHTML = `
            <div class="device-icon-large">
                ${icon}
            </div>
            <div class="device-info">
                <div class="device-name">${type}</div>
                <div class="device-details">${count}개 배치됨</div>
            </div>
            <div class="device-actions">
                <button class="btn-small" onclick="classroomModal.manageDeviceLocation('${type}')">
                    <i class="fas fa-map-marker-alt"></i> 위치 관리
                </button>
            </div>
        `;
        
        return item;
    }
    
    getDeviceIcon(deviceType) {
        const iconMap = {
            '모니터': '<i class="fas fa-desktop"></i>',
            '노트북': '<i class="fas fa-laptop"></i>',
            '태블릿': '<i class="fas fa-tablet-alt"></i>',
            '프린터': '<i class="fas fa-print"></i>',
            '스피커': '<i class="fas fa-volume-up"></i>',
            '카메라': '<i class="fas fa-camera"></i>',
            '키보드': '<i class="fas fa-keyboard"></i>',
            '마우스': '<i class="fas fa-mouse"></i>',
            '프로젝터': '<i class="fas fa-video"></i>',
            '스캐너': '<i class="fas fa-scanner"></i>',
            'default': '<i class="fas fa-microchip"></i>'
        };
        
        return iconMap[deviceType] || iconMap.default;
    }
    
    async loadSeats() {
        try {
            // 실제로는 서버에서 자리 정보를 가져와야 함
            // 현재는 샘플 데이터 사용
            this.seats = [
                { seatId: 1, seatName: '교사 자리', xCoordinate: 150, yCoordinate: 50, color: '#fbbf24' },
                { seatId: 2, seatName: '1번 자리', xCoordinate: 50, yCoordinate: 150, color: '#34d399' },
                { seatId: 3, seatName: '2번 자리', xCoordinate: 150, yCoordinate: 150, color: '#34d399' },
                { seatId: 4, seatName: '3번 자리', xCoordinate: 250, yCoordinate: 150, color: '#34d399' }
            ];
            
            this.displaySeats();
        } catch (error) {
            console.error('자리 정보 로딩 오류:', error);
        }
    }
    
    displaySeats() {
        const seatsList = document.getElementById('seatsList');
        seatsList.innerHTML = '';
        
        if (this.seats.length === 0) {
            seatsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chair" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p style="color: #64748b;">등록된 자리가 없습니다.</p>
                </div>
            `;
            return;
        }
        
        this.seats.forEach(seat => {
            const seatItem = this.createSeatItem(seat);
            seatsList.appendChild(seatItem);
        });
    }
    
    createSeatItem(seat) {
        const item = document.createElement('div');
        item.className = 'seat-item';
        item.dataset.seatId = seat.seatId;
        
        item.innerHTML = `
            <div class="seat-color" style="background-color: ${seat.color}"></div>
            <div class="seat-info">
                <div class="seat-name">${seat.seatName}</div>
                <div class="seat-position">위치: (${seat.xCoordinate}, ${seat.yCoordinate})</div>
            </div>
            <div class="seat-actions">
                <button class="btn-small" onclick="classroomModal.editSeat(${seat.seatId})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-small btn-danger" onclick="classroomModal.deleteSeat(${seat.seatId})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        return item;
    }
    
    renderRoomLayout() {
        const canvas = document.getElementById('roomCanvas');
        canvas.innerHTML = '';
        
        // 자리들 렌더링
        this.seats.forEach(seat => {
            const seatElement = this.createSeatElement(seat);
            canvas.appendChild(seatElement);
        });
        
        // 장비 위치들 렌더링 (추후 구현)
        this.renderDeviceLocations();
    }
    
    createSeatElement(seat) {
        const element = document.createElement('div');
        element.className = 'seat-element';
        element.dataset.seatId = seat.seatId;
        element.style.position = 'absolute';
        element.style.left = seat.xCoordinate + 'px';
        element.style.top = seat.yCoordinate + 'px';
        element.style.width = '40px';
        element.style.height = '30px';
        element.style.backgroundColor = seat.color;
        element.style.border = '1px solid #e5e7eb';
        element.style.borderRadius = '4px';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.fontSize = '0.7rem';
        element.style.fontWeight = '600';
        element.style.color = 'white';
        element.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
        element.style.cursor = this.isEditMode ? 'move' : 'pointer';
        element.textContent = seat.seatName.charAt(0);
        
        // 이벤트 리스너
        element.addEventListener('click', () => this.selectSeat(seat));
        
        if (this.isEditMode) {
            this.makeDraggable(element, seat);
        }
        
        return element;
    }
    
    renderDeviceLocations() {
        // 장비 위치 렌더링 로직 (추후 구현)
        // 각 자리에 배치된 장비들을 아이콘으로 표시
    }
    
    selectSeat(seat) {
        // 이전 선택 해제
        document.querySelectorAll('.seat-element').forEach(el => {
            el.style.boxShadow = 'none';
        });
        
        // 새 선택 표시
        const seatElement = document.querySelector(`[data-seat-id="${seat.seatId}"]`);
        if (seatElement) {
            seatElement.style.boxShadow = '0 0 0 2px #3b82f6';
        }
        
        this.selectedSeat = seat;
    }
    
    makeDraggable(element, seat) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = element.getBoundingClientRect();
            const canvasRect = document.getElementById('roomCanvas').getBoundingClientRect();
            
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            
            element.style.zIndex = '1000';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const canvasRect = document.getElementById('roomCanvas').getBoundingClientRect();
            const x = e.clientX - canvasRect.left - dragOffset.x;
            const y = e.clientY - canvasRect.top - dragOffset.y;
            
            element.style.left = Math.max(0, Math.min(x, canvasRect.width - element.offsetWidth)) + 'px';
            element.style.top = Math.max(0, Math.min(y, canvasRect.height - element.offsetHeight)) + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.zIndex = '';
                
                // 위치 업데이트
                seat.xCoordinate = parseInt(element.style.left);
                seat.yCoordinate = parseInt(element.style.top);
                
                // 자리 목록 업데이트
                this.displaySeats();
            }
        });
    }
    
    editRoomLayout() {
        this.isEditMode = !this.isEditMode;
        
        const button = document.querySelector('.edit-layout-btn');
        if (this.isEditMode) {
            button.innerHTML = '<i class="fas fa-check"></i> 편집 완료';
            button.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        } else {
            button.innerHTML = '<i class="fas fa-edit"></i> 배치 편집';
            button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        }
        
        // 레이아웃 다시 렌더링
        this.renderRoomLayout();
    }
    
    addNewSeat() {
        const seatName = prompt('자리 이름을 입력하세요:', `${this.seats.length + 1}번 자리`);
        if (!seatName || !seatName.trim()) return;
        
        const newSeat = {
            seatId: Date.now(), // 임시 ID
            seatName: seatName.trim(),
            xCoordinate: 100 + (this.seats.length % 5) * 60,
            yCoordinate: 100 + Math.floor(this.seats.length / 5) * 50,
            color: '#34d399'
        };
        
        this.seats.push(newSeat);
        this.displaySeats();
        this.renderRoomLayout();
    }
    
    editSeat(seatId) {
        const seat = this.seats.find(s => s.seatId == seatId);
        if (!seat) return;
        
        const newName = prompt('자리 이름을 입력하세요:', seat.seatName);
        if (newName && newName.trim()) {
            seat.seatName = newName.trim();
            this.displaySeats();
            this.renderRoomLayout();
        }
    }
    
    deleteSeat(seatId) {
        if (!confirm('이 자리를 삭제하시겠습니까?')) return;
        
        this.seats = this.seats.filter(s => s.seatId != seatId);
        this.displaySeats();
        this.renderRoomLayout();
    }
    
    manageDeviceLocation(deviceType) {
        alert(`${deviceType} 위치 관리 기능은 준비 중입니다.`);
        // 장비 위치 관리 로직 추후 구현
    }
    
    async saveClassroomLayout() {
        if (!this.currentClassroomId) return;
        
        try {
            const saveData = {
                classroomId: this.currentClassroomId,
                seats: this.seats,
                deviceLocations: this.deviceLocations
            };
            
            // 실제 저장 API 호출 (추후 구현)
            console.log('저장할 데이터:', saveData);
            
            this.showSuccess('교실 레이아웃이 저장되었습니다.');
        } catch (error) {
            console.error('저장 오류:', error);
            this.showError('저장 중 오류가 발생했습니다.');
        }
    }
    
    clearRoomCanvas() {
        const canvas = document.getElementById('roomCanvas');
        if (canvas) {
            canvas.innerHTML = '';
        }
    }
    
    showSuccess(message) {
        // 알림 표시 (기존 showNotification 함수 활용)
        if (window.showNotification) {
            window.showNotification(message, 'success');
        } else {
            alert(message);
        }
    }
    
    showError(message) {
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            alert(message);
        }
    }
}

// 전역 함수들
function closeClassroomModal() {
    if (window.classroomModal) {
        window.classroomModal.closeModal();
    }
}

function editRoomLayout() {
    if (window.classroomModal) {
        window.classroomModal.editRoomLayout();
    }
}

function addNewSeat() {
    if (window.classroomModal) {
        window.classroomModal.addNewSeat();
    }
}

function saveClassroomLayout() {
    if (window.classroomModal) {
        window.classroomModal.saveClassroomLayout();
    }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.classroomModal = new ClassroomModal();
}); 