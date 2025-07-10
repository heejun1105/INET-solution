import FloorPlanManager from './modules/FloorPlanManager.js';
import ScrollFixManager from './modules/ScrollFixManager.js';

// DOM이 완전히 로드된 후에 애플리케이션을 초기화합니다.
document.addEventListener('DOMContentLoaded', () => {
    // 애플리케이션의 핵심인 FloorPlanManager를 생성하여 시작합니다.
    const floorPlanManager = new FloorPlanManager();

    // 전역 스코프에 인스턴스를 노출시켜 콘솔에서 디버깅 용도로 사용할 수 있게 합니다. (선택 사항)
    window.floorPlanManager = floorPlanManager;

    // 스크롤 시 특정 UI 요소(툴바 등)를 상단에 고정시키는 기능을 활성화합니다.
    const scrollFixManager = new ScrollFixManager();
    window.scrollFixManager = scrollFixManager; // 디버깅용
});