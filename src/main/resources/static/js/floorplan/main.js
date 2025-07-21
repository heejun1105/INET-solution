import FloorPlanManager from './modules/FloorPlanManager.js';
import ScrollFixManager from './modules/ScrollFixManager.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 학교 평면도 관리 모듈 초기화');
    
    // 도형 관련 CSS 스타일 추가
    addShapeStyles();
    
    const floorPlanManager = new FloorPlanManager();

    // 모드 탭 전환
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const mode = this.dataset.mode;
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.toolbar').forEach(toolbar => toolbar.classList.remove('active'));
            document.getElementById(`${mode}Toolbar`).classList.add('active');
        });
    });
    
    // 도구 버튼 클릭 처리
    document.querySelectorAll('.tool-button').forEach(button => {
        button.addEventListener('click', function() {
            const activeToolbar = document.querySelector('.toolbar.active');
            if (activeToolbar) {
                activeToolbar.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });

    // 스크롤 고정 관리자 초기화 (도구바, 미배치교실 패널, 확대/축소 컨트롤)
    const scrollFixManager = new ScrollFixManager({
        items: [
            {
                element: document.querySelector('.toolbar.active'),
                fixedClass: 'fixed',
                offset: 60 // 네비바 높이
            },
            {
                element: document.getElementById('unplacedRoomsPanel'),
                fixedClass: 'fixed',
                offset: 140 // 네비바(60px) + 도구모음 높이(약 80px)
            },
            {
                element: document.querySelector('.panel-toggle'),
                fixedClass: 'fixed',
                offset: 175 // 네비바(60px) + 도구모음 높이(약 80px) + 여유 공간(35px)
            },
            {
                element: document.querySelector('.zoom-controls'),
                fixedClass: 'fixed',
                offset: 140 // 네비바(60px) + 도구모음 높이(약 80px)
            }
        ],
        scrollContainer: window,
        scrollTarget: document.querySelector('.canvas-container')
    });
    
    // 윈도우 객체에 스크롤 고정 관리자 저장 (다른 모듈에서 접근 가능하도록)
    window.scrollFixManager = scrollFixManager;
    
    // 알림 메시지 자동 숨김 기능
    document.querySelectorAll('.notification').forEach(notification => {
        notification.addEventListener('click', () => {
            notification.classList.remove('show');
        });
    });
    
    // 캔버스 클릭 이벤트 방지 (버블링 중지)
    const canvas = document.getElementById('canvasContent');
    if (canvas) {
        canvas.addEventListener('click', e => {
            if (e.target === canvas) {
                e.stopPropagation();
            }
        });
    }

    // 드롭다운 메뉴 초기화
    initDropdowns();
    
    // 도형도 같이 움직일 수 있도록 그룹 드래그에 포함
    const dragManager = floorPlanManager.dragManager;
    const originalIsValidDraggable = dragManager.isValidDraggable;

    // 기존의 isValidDraggable 함수를 오버라이드하여 도형도 드래그 가능하게 설정
    dragManager.isValidDraggable = function(element) {
        if (element.classList.contains('shape')) {
            return true;
        }
        return originalIsValidDraggable.call(dragManager, element);
    };
    
    console.log('✅ 학교 평면도 관리 모듈 초기화 완료');
});

// 도형 관련 CSS 스타일 추가
function addShapeStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* 도형 요소 공통 스타일 */
        .shape {
            position: absolute;
            box-sizing: border-box;
            cursor: move;
            transition: outline 0.15s ease-in-out;
        }
        
        /* 도형 호버 효과 */
        .shape:hover {
            outline: 2px dashed #3b82f6;
            outline-offset: 2px;
            z-index: 1000 !important;
        }
        
        /* 선택된 도형 스타일 */
        .shape.selected {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
            z-index: 1001 !important;
        }
        
        /* 복수 선택된 도형 스타일 */
        .shape.multi-selected {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
            z-index: 1001 !important;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }
        
        /* 도형 유형별 스타일 */
        .shape-line, .shape-arrow, .shape-dashed {
            transform-origin: center;
        }
        
        /* 다중 선택 정보 표시 */
        #multiSelectInfo {
            position: fixed;
            top: 10px;
            right: 10px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            display: none;
            z-index: 2000;
            transition: opacity 0.3s ease;
            max-width: 200px;
            text-align: center;
        }
        
        #multiSelectInfo.show {
            display: block;
        }
    `;
    document.head.appendChild(styleElement);
    
    // 다중 선택 정보 표시 요소 추가
    const multiSelectInfo = document.createElement('div');
    multiSelectInfo.id = 'multiSelectInfo';
    multiSelectInfo.innerHTML = '<span id="multiSelectText">0개 요소 선택됨</span>';
    document.body.appendChild(multiSelectInfo);
}

// 드롭다운 메뉴 초기화
function initDropdowns() {
    // 도형 드롭다운 버튼 이벤트 설정
    const shapeButton = document.getElementById('shapeButton');
    const shapeDropdown = document.getElementById('shapeDropdown');
    
    if (shapeButton && shapeDropdown) {
        // 드롭다운 메뉴 초기 상태 (숨김)
        shapeDropdown.classList.remove('show');
    }
    
    // 기타공간 드롭다운 버튼 이벤트 설정
    const otherSpaceButton = document.getElementById('otherSpaceButton');
    const otherSpaceDropdown = document.getElementById('otherSpaceDropdown');
    
    if (otherSpaceButton && otherSpaceDropdown) {
        // 드롭다운 메뉴 초기 상태 (숨김)
        otherSpaceDropdown.classList.remove('show');
    }
}