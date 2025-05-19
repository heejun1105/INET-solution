package com.inet.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import com.inet.entity.Classroom;
import com.inet.entity.School;
import com.inet.repository.ClassroomRepository;
import com.inet.repository.SchoolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ClassroomService {
    
    private final ClassroomRepository classroomRepository;
    private final SchoolRepository schoolRepository;
    
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
} 