package com.inet.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import com.inet.entity.School;
import com.inet.repository.SchoolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import lombok.extern.log4j.Log4j2;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Log4j2
public class SchoolService {
    
    private final SchoolRepository schoolRepository;
    
    // Create
    public School saveSchool(School school) {
        log.info("Saving school: {}", school);
        return schoolRepository.save(school);
    }
    
    // Read
    public List<School> getAllSchools() {
        log.info("Getting all schools");
        return schoolRepository.findAll();
    }
    
    public Optional<School> getSchoolById(Long id) {
        log.info("Getting school by id: {}", id);
        return schoolRepository.findById(id);
    }
    
    // Update
    public School updateSchool(School school) {
        log.info("Updating school: {}", school);
        return schoolRepository.save(school);
    }
    
    // Delete
    public void deleteSchool(Long id) {
        log.info("Deleting school with id: {}", id);
        schoolRepository.deleteById(id);
    }

    public Optional<School> findById(Long schoolId) {
        return schoolRepository.findById(schoolId);
    }
} 