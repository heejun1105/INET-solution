package com.inet.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import com.inet.entity.Operator;
import com.inet.repository.OperatorRepository;
import com.inet.entity.School;

import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

@Service
@RequiredArgsConstructor
@Log4j2
public class OperatorService {
    
    private final OperatorRepository operatorRepository;
    
    // Create
    public Operator saveOperator(Operator operator) {
        log.info("Saving operator: {}", operator);
        return operatorRepository.save(operator);
    }
    
    // Read
    public List<Operator> getAllOperators() {
        log.info("Getting all operators");
        return operatorRepository.findAll();
    }
    
    public Optional<Operator> getOperatorById(Long id) {
        log.info("Getting operator by id: {}", id);
        return operatorRepository.findById(id);
    }
    
    // Update
    public Operator updateOperator(Operator operator) {
        log.info("Updating operator: {}", operator);
        return operatorRepository.save(operator);
    }
    
    // Delete
    public void deleteOperator(Long id) {
        log.info("Deleting operator with id: {}", id);
        operatorRepository.deleteById(id);
    }

    public Optional<Operator> findByNameAndPositionAndSchool(String name, String position, School school) {
        return operatorRepository.findByNameAndPositionAndSchool(name, position, school);
    }
    
    public Optional<Operator> findByNameAndSchoolAndPositionIsNull(String name, School school) {
        return operatorRepository.findByNameAndSchoolAndPositionIsNull(name, school);
    }
    
    public List<Operator> findBySchoolAndName(School school, String name) {
        return operatorRepository.findBySchoolAndName(school, name);
    }
} 