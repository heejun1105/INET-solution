package com.inet.entity;

public enum SecurityQuestion {
    FAVORITE_COLOR("가장 좋아하는 색깔은?"),
    FIRST_PET("첫 번째 반려동물의 이름은?"),
    ELEMENTARY_SCHOOL("졸업한 초등학교는?"),
    FAVORITE_FOOD("가장 좋아하는 음식은?"),
    BIRTH_CITY("태어난 도시는?"),
    FAVORITE_MOVIE("가장 좋아하는 영화는?"),
    FIRST_CAR("첫 번째 차량의 모델명은?"),
    FAVORITE_SPORT("가장 좋아하는 스포츠는?"),
    CHILDHOOD_NICKNAME("어린 시절 별명은?"),
    FAVORITE_SONG("가장 좋아하는 노래는?");
    
    private final String question;
    
    SecurityQuestion(String question) {
        this.question = question;
    }
    
    public String getQuestion() {
        return question;
    }
} 