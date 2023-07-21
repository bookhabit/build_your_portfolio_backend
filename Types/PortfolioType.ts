export type PortfolioType = {
    author:string;
    title:string; 
    purpose:string;
    introduce:string;
    process:string[]; 
    learned:string[];
    photos: string[],
    usedTechnology:string[];
    developPeriod:DevelopPeriodType;
    demoLink:DemoLinkType;
    category:CategoryType;
    selectedUI:SelectedUI
}

export type DemoLinkType = {
    projectURL:string;
    githubURL:string;
    designURL:string;
    documentURL:string;
}

export type DevelopPeriodType = {
    start:string,
    end:string,
}

export type CategoryType = "clone"|"individual"|"cooperation"
export type SelectedUI = "A"|"B"|"C"|"D"
