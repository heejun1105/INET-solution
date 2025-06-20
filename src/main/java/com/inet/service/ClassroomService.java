package com.inet.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import com.inet.entity.Classroom;
import com.inet.entity.School;
import com.inet.entity.Device;
import com.inet.entity.WirelessAp;
import com.inet.repository.ClassroomRepository;
import com.inet.repository.SchoolRepository;
import com.inet.repository.DeviceRepository;
import com.inet.repository.WirelessApRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.ArrayList;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ClassroomService {
    
    private final ClassroomRepository classroomRepository;
    private final SchoolRepository schoolRepository;
    private final DeviceRepository deviceRepository;
    private final WirelessApRepository wirelessApRepository;
    
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
        return classroomRepository.save(classroom);
    }
    
    public void deleteClassroom(Long id) {
        log.info("Deleting classroom with id: {}", id);
        
        // 교실을 사용하는 장비가 있는지 확인
        Classroom classroom = classroomRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + id));
        List<Device> devices = deviceRepository.findByClassroom(classroom);
        List<WirelessAp> wirelessAps = wirelessApRepository.findByLocation(classroom);
        
        if (!devices.isEmpty() || !wirelessAps.isEmpty()) {
            throw new IllegalStateException("이 교실을 사용하는 장비나 무선AP가 있어서 삭제할 수 없습니다.");
        }
        
        classroomRepository.deleteById(id);
    }
    
    public List<Classroom> findBySchoolId(Long schoolId) {
        return classroomRepository.findBySchoolSchoolId(schoolId);
    }
    
    public Optional<Classroom> findByRoomNameAndSchool(String roomName, Long schoolId) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
        return classroomRepository.findByRoomNameAndSchool(roomName, school);
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
            classroomRepository.save(targetClassroom);
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