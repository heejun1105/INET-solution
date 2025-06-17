package com.inet.controller;

import com.inet.entity.School;
import com.inet.service.SchoolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Controller
@RequestMapping("/school")
@RequiredArgsConstructor
public class SchoolController {

    private final SchoolService schoolService;

    @GetMapping("/manage")
    public String manageSchools(Model model) {
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        model.addAttribute("newSchool", new School());
        return "school/manage";
    }

    @PostMapping("/add")
    public String addSchool(@ModelAttribute School school, RedirectAttributes redirectAttributes) {
        try {
            if (school.getSchoolName() == null || school.getSchoolName().trim().isEmpty()) {
                redirectAttributes.addFlashAttribute("error", "학교명을 입력해주세요.");
                return "redirect:/school/manage";
            }
            
            schoolService.saveSchool(school);
            redirectAttributes.addFlashAttribute("success", "학교가 성공적으로 추가되었습니다.");
            
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "학교 추가 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/school/manage";
    }

    @PostMapping("/delete/{id}")
    public String deleteSchool(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        try {
            schoolService.deleteSchool(id);
            redirectAttributes.addFlashAttribute("success", "학교가 성공적으로 삭제되었습니다.");
            
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "학교 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/school/manage";
    }

    @GetMapping("/count")
    @ResponseBody
    public long getSchoolCount() {
        return schoolService.countAllSchools();
    }
} 