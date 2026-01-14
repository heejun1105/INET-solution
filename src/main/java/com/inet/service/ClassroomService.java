package com.inet.service;

import com.inet.entity.Classroom;
import com.inet.entity.School;
import com.inet.entity.Device;
import com.inet.entity.WirelessAp;
import com.inet.repository.ClassroomRepository;
import com.inet.repository.SchoolRepository;
import com.inet.repository.DeviceRepository;
import com.inet.repository.WirelessApRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class ClassroomService {
    
    private static final Logger log = LoggerFactory.getLogger(ClassroomService.class);
    
    private final ClassroomRepository classroomRepository;
    private final SchoolRepository schoolRepository;
    private final DeviceRepository deviceRepository;
    private final WirelessApRepository wirelessApRepository;
    private final FloorPlanClassroomSyncService floorPlanClassroomSyncService;

    public ClassroomService(ClassroomRepository classroomRepository,
                            SchoolRepository schoolRepository,
                            DeviceRepository deviceRepository,
                            WirelessApRepository wirelessApRepository,
                            FloorPlanClassroomSyncService floorPlanClassroomSyncService) {
        this.classroomRepository = classroomRepository;
        this.schoolRepository = schoolRepository;
        this.deviceRepository = deviceRepository;
        this.wirelessApRepository = wirelessApRepository;
        this.floorPlanClassroomSyncService = floorPlanClassroomSyncService;
    }
    
    public Classroom saveClassroom(Classroom classroom) {
        try {
            log.info("Saving classroom: {}", classroom);
            if (classroom.getRoomName() == null || classroom.getRoomName().trim().isEmpty()) {
                throw new IllegalArgumentException("교실 이름이 필요합니다.");
            }
            if (classroom.getSchool() == null) {
                throw new IllegalArgumentException("학교 정보가 필요합니다.");
            }
            
            // 동일 학교 내 동일 교실명 검사
            Optional<Classroom> existingClassroom = classroomRepository.findByRoomNameAndSchool(
                classroom.getRoomName(), 
                classroom.getSchool()
            );
            
            if (existingClassroom.isPresent() && !existingClassroom.get().getClassroomId().equals(classroom.getClassroomId())) {
                throw new IllegalArgumentException("이미 동일한 교실명이 해당 학교에 존재합니다.");
            }
            
            return classroomRepository.save(classroom);
        } catch (Exception e) {
            log.error("교실 저장 중 오류 발생: {}", e.getMessage());
            throw new RuntimeException("교실 저장 중 오류가 발생했습니다.", e);
        }
    }
    
    public List<Classroom> getAllClassrooms() {
        log.info("Getting all classrooms");
        return classroomRepository.findAll();
    }
    
    public Optional<Classroom> getClassroomById(Long id) {
        log.info("Getting classroom by id: {}", id);
        return classroomRepository.findById(id);
    }
    
    public Classroom updateClassroom(Classroom classroom) {
        log.info("Updating classroom: {}", classroom);
        Classroom saved = classroomRepository.save(classroom);
        floorPlanClassroomSyncService.updateClassroomElements(saved.getClassroomId(), saved.getRoomName());
        return saved;
    }
    
    public void deleteClassroom(Long id) {
        log.info("Deleting classroom with id: {}", id);
        
        // 교실을 사용하는 장비가 있는지 확인
        Classroom classroom = classroomRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + id));
        List<Device> devices = deviceRepository.findByClassroom(classroom);
        List<WirelessAp> wirelessAps = wirelessApRepository.findByLocation(classroom);
        
        if (!devices.isEmpty() || !wirelessAps.isEmpty()) {
            throw new IllegalStateException("이 교실을 사용하는 장비나 무선AP가 있어서 삭제할 수 없습니다. 장비가 무선AP를 먼저 삭제해주세요.");
        }
        
        floorPlanClassroomSyncService.removeClassroomElements(id);
        classroomRepository.deleteById(id);
    }
    
    public List<Classroom> findBySchoolId(Long schoolId) {
        List<Classroom> classrooms = classroomRepository.findBySchoolSchoolId(schoolId);
        
        // 순서가 없는 교실들을 가나다 순으로 초기화
        initializeDisplayOrderIfNeeded(classrooms);
        
        // 순서가 있는 경우 순서대로, 순서가 없는 경우 가나다 순으로 정렬
        classrooms.sort((c1, c2) -> {
            Integer order1 = c1.getDisplayOrder();
            Integer order2 = c2.getDisplayOrder();
            
            // 둘 다 순서가 있는 경우
            if (order1 != null && order2 != null) {
                return order1.compareTo(order2);
            }
            // c1만 순서가 있는 경우
            if (order1 != null) {
                return -1;
            }
            // c2만 순서가 있는 경우
            if (order2 != null) {
                return 1;
            }
            // 둘 다 순서가 없는 경우 가나다 순
            String name1 = c1.getRoomName() != null ? c1.getRoomName() : "";
            String name2 = c2.getRoomName() != null ? c2.getRoomName() : "";
            return name1.compareTo(name2);
        });
        return classrooms;
    }
    
    /**
     * 교실 순서를 업데이트합니다.
     * @param classroomId 교실 ID
     * @param newOrder 새로운 순서 (1부터 시작)
     * @param schoolId 학교 ID (같은 학교 내에서만 순서 조정)
     */
    public void updateClassroomOrder(Long classroomId, Integer newOrder, Long schoolId) {
        log.info("Updating classroom order: classroomId={}, newOrder={}, schoolId={}", classroomId, newOrder, schoolId);
        
        if (newOrder == null || newOrder < 1) {
            throw new IllegalArgumentException("순서는 1 이상이어야 합니다.");
        }
        
        Classroom targetClassroom = classroomRepository.findById(classroomId)
            .orElseThrow(() -> new RuntimeException("교실을 찾을 수 없습니다: " + classroomId));
        
        if (!targetClassroom.getSchool().getSchoolId().equals(schoolId)) {
            throw new IllegalArgumentException("해당 교실은 선택한 학교에 속하지 않습니다.");
        }
        
        // 같은 학교의 모든 교실 가져오기
        List<Classroom> allClassrooms = classroomRepository.findBySchoolSchoolId(schoolId);
        
        // 순서가 없는 교실들을 가나다 순으로 초기화
        initializeDisplayOrderIfNeeded(allClassrooms);
        
        // 현재 순서 가져오기
        Integer currentOrder = targetClassroom.getDisplayOrder();
        
        if (currentOrder != null && currentOrder.equals(newOrder)) {
            log.info("순서가 변경되지 않았습니다.");
            return;
        }
        
        // 순서 재조정
        if (currentOrder == null || newOrder < currentOrder) {
            // 순서를 앞으로 이동 (예: 5번을 2번으로)
            // 2번부터 (currentOrder-1)번까지의 교실들을 1씩 뒤로 밀기
            for (Classroom classroom : allClassrooms) {
                if (classroom.getDisplayOrder() != null && 
                    classroom.getDisplayOrder() >= newOrder && 
                    classroom.getDisplayOrder() < (currentOrder != null ? currentOrder : Integer.MAX_VALUE) &&
                    !classroom.getClassroomId().equals(classroomId)) {
                    classroom.setDisplayOrder(classroom.getDisplayOrder() + 1);
                    classroomRepository.save(classroom);
                }
            }
        } else {
            // 순서를 뒤로 이동 (예: 2번을 5번으로)
            // (currentOrder+1)번부터 newOrder번까지의 교실들을 1씩 앞으로 당기기
            for (Classroom classroom : allClassrooms) {
                if (classroom.getDisplayOrder() != null && 
                    classroom.getDisplayOrder() > currentOrder && 
                    classroom.getDisplayOrder() <= newOrder &&
                    !classroom.getClassroomId().equals(classroomId)) {
                    classroom.setDisplayOrder(classroom.getDisplayOrder() - 1);
                    classroomRepository.save(classroom);
                }
            }
        }
        
        // 대상 교실의 순서 업데이트
        targetClassroom.setDisplayOrder(newOrder);
        classroomRepository.save(targetClassroom);
        
        log.info("교실 순서 업데이트 완료: classroomId={}, newOrder={}", classroomId, newOrder);
    }
    
    /**
     * 순서가 없는 교실들에 대해 가나다 순으로 순서를 초기화합니다.
     * @param classrooms 교실 목록
     */
    private void initializeDisplayOrderIfNeeded(List<Classroom> classrooms) {
        // 순서가 없는 교실들을 가나다 순으로 정렬
        List<Classroom> unorderedClassrooms = classrooms.stream()
            .filter(c -> c.getDisplayOrder() == null)
            .sorted((c1, c2) -> {
                String name1 = c1.getRoomName() != null ? c1.getRoomName() : "";
                String name2 = c2.getRoomName() != null ? c2.getRoomName() : "";
                return name1.compareTo(name2);
            })
            .collect(Collectors.toList());
        
        if (unorderedClassrooms.isEmpty()) {
            return;
        }
        
        // 기존 순서의 최대값 찾기
        int maxOrder = classrooms.stream()
            .filter(c -> c.getDisplayOrder() != null)
            .mapToInt(Classroom::getDisplayOrder)
            .max()
            .orElse(0);
        
        // 순서가 없는 교실들에 순서 부여
        for (int i = 0; i < unorderedClassrooms.size(); i++) {
            unorderedClassrooms.get(i).setDisplayOrder(maxOrder + i + 1);
            classroomRepository.save(unorderedClassrooms.get(i));
        }
    }
    
    public Optional<Classroom> findByRoomNameAndSchool(String roomName, Long schoolId) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
        // 중복된 교실 이름이 있을 경우 첫 번째를 반환
        return classroomRepository.findFirstByRoomNameAndSchool(roomName, school);
    }
    
    @Deprecated
    public Classroom findByRoomName(String roomName) {
        log.warn("Deprecated method findByRoomName is called. Please use findByRoomNameAndSchool instead.");
        return classroomRepository.findByRoomName(roomName);
    }
    
    /**
     * 학교별 중복 가능성이 있는 교실들을 그룹화하여 반환
     */
    public Map<String, List<Classroom>> findDuplicateClassrooms(Long schoolId) {
        log.info("Finding duplicate classrooms for school: {}", schoolId);
        List<Classroom> classrooms = findBySchoolId(schoolId);
        
        return classrooms.stream()
            .collect(Collectors.groupingBy(
                classroom -> normalizeRoomName(classroom.getRoomName())
            ))
            .entrySet().stream()
            .filter(entry -> entry.getValue().size() > 1)
            .collect(Collectors.toMap(
                Map.Entry::getKey,
                Map.Entry::getValue
            ));
    }
    
    /**
     * 교실명 정규화 (공백, 특수문자 제거하여 비교)
     */
    private String normalizeRoomName(String roomName) {
        if (roomName == null) return "";
        return roomName.toLowerCase()
            .replaceAll("\\s+", "")  // 공백 제거
            .replaceAll("[학년반]", "")  // "학년", "반" 제거
            .replaceAll("[-_()\\[\\]]", "")  // 특수문자 제거
            .trim();
    }
    
    /**
     * 교실 병합 - sourceIds의 교실들을 targetId 교실로 병합
     */
    @Transactional
    public void mergeClassrooms(Long targetId, List<Long> sourceIds, String newRoomName) {
        log.info("Merging classrooms. Target: {}, Sources: {}, New name: {}", targetId, sourceIds, newRoomName);
        
        // 대상 교실 조회
        Classroom targetClassroom = classroomRepository.findById(targetId)
            .orElseThrow(() -> new RuntimeException("Target classroom not found with id: " + targetId));
        
        // 교실명 업데이트
        if (newRoomName != null && !newRoomName.trim().isEmpty()) {
            targetClassroom.setRoomName(newRoomName.trim());
            targetClassroom = classroomRepository.save(targetClassroom);
            floorPlanClassroomSyncService.updateClassroomElements(targetClassroom.getClassroomId(), targetClassroom.getRoomName());
        } else {
            floorPlanClassroomSyncService.updateClassroomElements(targetClassroom.getClassroomId(), targetClassroom.getRoomName());
        }
        
        // 각 소스 교실의 장비들을 대상 교실로 이동
        for (Long sourceId : sourceIds) {
            if (sourceId.equals(targetId)) continue; // 자기 자신은 제외
            
            Classroom sourceClassroom = classroomRepository.findById(sourceId)
                .orElseThrow(() -> new RuntimeException("Source classroom not found with id: " + sourceId));
            
            // 장비 이동
            List<Device> devices = deviceRepository.findByClassroom(sourceClassroom);
            for (Device device : devices) {
                device.setClassroom(targetClassroom);
                deviceRepository.save(device);
            }
            
            // 무선AP 이동
            List<WirelessAp> wirelessAps = wirelessApRepository.findByLocation(sourceClassroom);
            for (WirelessAp ap : wirelessAps) {
                ap.setLocation(targetClassroom);
                wirelessApRepository.save(ap);
            }
            
            // 소스 교실 삭제
            floorPlanClassroomSyncService.removeClassroomElements(sourceId);
            classroomRepository.deleteById(sourceId);
            log.info("Merged and deleted classroom: {}", sourceId);
        }
        
        log.info("Classroom merge completed successfully");
    }
    
    /**
     * 교실 사용 현황 조회 (장비 수, 무선AP 수)
     */
    public ClassroomUsageInfo getClassroomUsage(Long classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId)
            .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + classroomId));
            
        List<Device> devices = deviceRepository.findByClassroom(classroom);
        List<WirelessAp> wirelessAps = wirelessApRepository.findByLocation(classroom);
        
        return new ClassroomUsageInfo(
            classroomId,
            devices.size(),
            wirelessAps.size()
        );
    }
    
    /**
     * 교실 사용 현황 정보 클래스
     */
    public static class ClassroomUsageInfo {
        private final Long classroomId;
        private final int deviceCount;
        private final int wirelessApCount;
        
        public ClassroomUsageInfo(Long classroomId, int deviceCount, int wirelessApCount) {
            this.classroomId = classroomId;
            this.deviceCount = deviceCount;
            this.wirelessApCount = wirelessApCount;
        }
        
        public Long getClassroomId() { return classroomId; }
        public int getDeviceCount() { return deviceCount; }
        public int getWirelessApCount() { return wirelessApCount; }
        public int getTotalCount() { return deviceCount + wirelessApCount; }
        public boolean isEmpty() { return getTotalCount() == 0; }
    }
} 