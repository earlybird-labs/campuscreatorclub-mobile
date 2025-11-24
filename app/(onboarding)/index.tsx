import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  ImageBackground,
} from "react-native";
import React, { useEffect, useRef } from "react";
import { Image } from "expo-image";
import CccBigSvg from "@/assets/svgs/CccBigLogo";
import CccSmallSvg from "@/assets/svgs/CccSmallLogo";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HeroBg from "@/assets/images/HeroBg.png";
import { StatusBar } from "expo-status-bar";

const { width } = Dimensions.get("window");

interface Testimonial {
  id: number;
  name: string;
  university: string;
  review: string;
  image: string;
  rating: number;
}

// Sample testimonial data
const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Harley Johnson",
    university: "South Dakota State University",
    review:
      "CCC has been amazing so far. I've gotten plenty of great opportunities to expand my account and the ability to connect with others my age doing the same thing.",
    image: "https://drive.google.com/uc?id=1m2GnBviEpG6VjnLQGz4QSLbZgYQVYpg-",
    rating: 5.0,
  },
  {
    id: 2,
    name: "Allison Gedeon",
    university: "Duquesne",
    review:
      "CCC has provided many opportunities to get advice and tips on growing my platform! Every experience I've had with CCC management has been positive, and I have been welcomed with nothing but kindness. CCC has been a great outlet to add to my resume and open doors to brand opportunities, altogether teaching me more and more about social media and marketing.",
    image: "https://drive.google.com/uc?id=1gHLMFIrN-dh-Jlk-TadJ0aF3TkaJICAk",
    rating: 5.0,
  },
  {
    id: 3,
    name: "Emily Siano",
    university: "Florida Atlantic University",
    review:
      "I've gotten to connect with so many new people who all have similar interests and goals as me which is an amazing experience. I also have now gotten two collabs with two really cool brands.",
    image: "https://drive.google.com/uc?id=1BDM7HPf7q9ohBxZ9QOaFpozj7BuprmsQ",
    rating: 5.0,
  },
  {
    id: 4,
    name: "MaryKate Richmond",
    university: "Miami University",
    review:
      "Great opportunities and they have come in quick! You guys are so helpful and kind. I love it :)",
    image: "https://drive.google.com/uc?id=1nLcvvT22TO3ik7jlS2zT3k0FLXolYDv_",
    rating: 5.0,
  },
  {
    id: 5,
    name: "Katherine Leyden",
    university: "The University of Mississippi",
    review:
      "The platform makes it easy to stay in the loop with new campaigns, and I genuinely feel encouraged and valued as a creator. It's been so refreshing to be surrounded by like-minded people who uplift and motivate one another, all while building our brands together. I'm so glad I found this space—it's helped open doors I didn't even know existed!",
    image: "https://drive.google.com/uc?id=18XtLiiQB9yPOic8ak79Jm5yf6CtLuo3j",
    rating: 5.0,
  },
  {
    id: 6,
    name: "Kaitlyn Cope",
    university: "Roberts Wesleyan University",
    review:
      "I love being a part of CCC! I've already learned so much about content creation and seen growth in my accounts! I'm thankful for the opportunity to learn from creators like Abby Gendell! I think it's so cool that we get the chance to be featured on CCC's socials and make new friends along the way! I'm super excited about the brand deals coming up as well!",
    image: "https://drive.google.com/uc?id=1cica_X5SxQHRf44RAobmschg1aDRumJl",
    rating: 5.0,
  },
  {
    id: 7,
    name: "Henley Barz",
    university: "Florida Gulf Coast University",
    review:
      "Campus Creator Club is the real deal. It's not just tips and emails — it's a community of creators who actually support each other. I've learned more about content, landed opportunities, and grown my platform just by being part of it. If you're serious about creating, join CCC.",
    image: "https://drive.google.com/uc?id=1BkVFHHL_mSyoe2iSOYm17zxwMEnEtpjr",
    rating: 5.0,
  },
  {
    id: 8,
    name: "Isabella Morreale",
    university: "Lynn University",
    review:
      "It's really the most supportive group of people and so inspiring to see & help others with their journeys as well as the incredible opportunities that are presented to us with this club.",
    image: "https://drive.google.com/uc?id=19x_VNoLz7yPlNj8_jlLw8IF42Fz7ABxV",
    rating: 5.0,
  },
  {
    id: 9,
    name: "Hannah McCabe",
    university: "San Jose State University",
    review:
      "I love the campus creator club! All the members are so supportive on my social media platforms, and the amount of opportunities offered from the CCC are amazing considering I've only been in it for about a month.",
    image: "https://drive.google.com/uc?id=1O8j6dGZOAtR-nBa1nB6IVuMkX922HxRg",
    rating: 5.0,
  },
  {
    id: 10,
    name: "Madison Tessar",
    university: "University of Tampa",
    review:
      "CCC has been a great resource for me to connect with other creators and be able to work with brands to promote content! I have been able to gain followers and connect with other people to learn how to grow my account to make my social image better! I would recommend CCC to anyone who is interested in becoming a (micro)influencer and wants to take the first steps into learning how to do so!",
    image: "https://drive.google.com/uc?id=13lhOvGk25AXGzTYfydJuHDpdl1ISVw0m",
    rating: 5.0,
  },
];

interface TestimonialCardProps {
  testimonial: Testimonial;
}

const TestimonialCard = ({ testimonial }: TestimonialCardProps) => {
  return (
    <View className="mx-2 bg-white/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 w-[280px] h-[200px] mb-5">
      <View className="flex-row items-center mb-3">
        <Image
          source={{ uri: testimonial.image }}
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            width: 48,
            height: 48,
            borderRadius: 50,
            marginRight: 12,
          }}
        />
        <View className="flex-1">
          <Text
            className="text-white font-gMedium text-base leading-5"
            numberOfLines={1}
          >
            {testimonial.name}
          </Text>
          <Text
            className="text-white/80 font-gRegular text-xs leading-4"
            numberOfLines={2}
          >
            {testimonial.university}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-yellow-300 text-lg mr-1">★</Text>
          <Text className="text-white font-gMedium">{testimonial.rating}</Text>
        </View>
      </View>
      <View className="flex-1">
        <Text
          className="text-white/90 font-gRegular text-[13px] leading-5"
          numberOfLines={6}
        >
          {testimonial.review}
        </Text>
      </View>
      <StatusBar style="light" />
    </View>
  );
};

interface ScrollingTestimonialsProps {
  direction?: "left" | "right";
  speed?: number;
}

const ScrollingTestimonials = ({
  direction = "left",
  speed = 0.5,
}: ScrollingTestimonialsProps) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const testimonialWidth = 280 + 16; // Updated card width + margin
  const totalContentWidth = testimonialWidth * testimonials.length;

  useEffect(() => {
    const startValue = direction === "left" ? 0 : -totalContentWidth + width;
    const endValue = direction === "left" ? -totalContentWidth + width : 0;

    scrollX.setValue(startValue);

    Animated.loop(
      Animated.timing(scrollX, {
        toValue: endValue,
        duration: (totalContentWidth / speed) * 20,
        useNativeDriver: true,
        isInteraction: false,
      })
    ).start();

    return () => scrollX.stopAnimation();
  }, []);

  return (
    <View className="overflow-hidden">
      <Animated.View
        style={{
          flexDirection: "row",
          transform: [{ translateX: scrollX }],
        }}
      >
        {testimonials.map((item) => (
          <TestimonialCard key={item.id} testimonial={item} />
        ))}
        {testimonials.map((item) => (
          <TestimonialCard key={`dup-${item.id}`} testimonial={item} />
        ))}
      </Animated.View>
    </View>
  );
};

const index = () => {
  const insets = useSafeAreaInsets();
  return (
    <ImageBackground
      source={HeroBg}
      style={{
        flex: 1,
        paddingTop: insets.top,
      }}
    >
      <View className="flex-1 relative">
        <View className="items-center mt-2">
          <CccSmallSvg />
          <View className="items-center my-6">
            <Text className="text-white text-center text-[24px] font-gBold mt-2">
              Made by Creators, for
            </Text>
            <Text className="text-white text-center text-[24px] font-gBold">
              Creators Like You
            </Text>
          </View>
        </View>
        <View className="mt-2 mb-4">
          <ScrollingTestimonials direction="left" speed={0.3} />
          <ScrollingTestimonials direction="right" speed={0.4} />
          {/* <ScrollingTestimonials direction="left" speed={0.35} /> */}
        </View>
        <View className="mx-4 mt-4 mb-6">
          <TouchableOpacity
            className="bg-white/25 backdrop-blur-md border border-white/20 rounded-xl py-4 items-center shadow-lg"
            onPress={() => router.push("/board-1" as any)}
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text className="text-white font-gBold text-lg">Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
};

export default index;
