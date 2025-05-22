package com.jaein.school.service;

import com.jaein.school.entity.School;
import com.jaein.school.repository.SchoolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class SchoolService {

    private final SchoolRepository schoolRepository;

    public List<School> findAllSchools() {
        return schoolRepository.findAll();
    }

    public School findSchoolById(Long schoolId) {
        return schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("School not found with id: " + schoolId));
    }
} 