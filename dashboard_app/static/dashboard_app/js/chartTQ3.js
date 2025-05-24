// static/dashboard_app/js/chartTQ3.js

// Đảm bảo hàm này nhận đủ 3 tham số: containerSelector, tooltipElement, và dataPath
async function drawChartTQ3(containerSelector, tooltipElement, dataPath) { // ĐÃ SỬA: THÊM dataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    // Tiêu đề cho biểu đồ TQ3 - Được thêm vào đầu hàm để hiển thị ngay
    vizContainer.append("h4")
        .style("text-align", "center")
        .style("margin-bottom", "20px")
        .text("Biểu đồ TQ3: Doanh thu theo Phân khúc khách hàng"); // Tiêu đề cụ thể

    try {
        // ĐÃ SỬA: SỬ DỤNG dataPath ĐƯỢC TRUYỀN VÀO
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            console.error(`DEBUG TQ3: CSV tải về rỗng hoặc null từ ${dataPath}. Số hàng: ${allData ? allData.length : 'null/undefined'}`);
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }
        console.log("DEBUG TQ3: Dữ liệu thô đã tải thành công. Tổng số hàng:", allData.length);
        console.log("DEBUG TQ3: 5 hàng dữ liệu thô đầu tiên:", allData.slice(0, 5));
        console.log("DEBUG TQ3: Sample 'segment' values from raw data (first 5):", allData.slice(0, 5).map(d => d.segment));


        // 1. XỬ LÝ DỮ LIỆU (Giống hệt Q5 - Donut Chart theo segment)
        allData.forEach(d => {
            d.Sales = parseFloat(d.Sales);
            if (isNaN(d.Sales) || d.Sales < 0) d.Sales = 0;
            
            // ĐÃ SỬA: Thay d.segment bằng d.segment (chữ S hoa)
            if (typeof d.segment === 'undefined' || d.segment === null || String(d.segment).trim() === "") {
                d.segment = "Không xác định";
            }
        });
        console.log("DEBUG TQ3: Đã xử lý và làm sạch dữ liệu ban đầu.");


        const totalRevenue = d3.sum(allData, d => d.Sales);

        if (isNaN(totalRevenue) || totalRevenue <= 0) {
            vizContainer.html("<p>Tổng doanh thu không hợp lệ hoặc bằng 0 cho TQ3. Biểu đồ không được vẽ.</p>");
            console.error("DEBUG TQ3: Tổng doanh thu không hợp lệ hoặc bằng 0:", totalRevenue);
            return;
        }

        // ĐÃ SỬA: Thay d.segment bằng d.segment (chữ S hoa)
        const salesBysegmentRollup = d3.rollup(allData,
            v => d3.sum(v, d => d.Sales),
            d => d.segment
        );
        console.log("DEBUG TQ3: Đã gom nhóm dữ liệu theo segment. Số lượng nhóm:", salesBysegmentRollup.size);
        console.log("DEBUG TQ3: Dữ liệu sau gom nhóm (Map):", salesBysegmentRollup);


        let dataForChart = Array.from(salesBysegmentRollup, ([key, value]) => ({
            segment: key, // key là tên phân khúc (Consumer, Corporate, Home Office)
            Sales: value || 0,
            Percentage: (value || 0) / totalRevenue * 100
        }));
        console.log("DEBUG TQ3: dataForChart sau khi chuyển sang Array. Tổng số mục:", dataForChart.length);
        console.log("DEBUG TQ3: 5 mục đầu tiên của dataForChart:", dataForChart.slice(0, 5));


        dataForChart = dataForChart.filter(d => d.Sales > 0 && d.segment !== "Không xác định" && !isNaN(d.Percentage));
        console.log("DEBUG TQ3: dataForChart sau khi lọc. Số mục còn lại:", dataForChart.length);
        console.log("DEBUG TQ3: 5 mục đầu tiên của dataForChart sau lọc:", dataForChart.slice(0, 5));

        dataForChart.sort((a, b) => b.Sales - a.Sales); // Sắp xếp theo Sales giảm dần
        console.log("DEBUG TQ3: dataForChart sau khi sắp xếp:", dataForChart);

        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Phân khúc hợp lệ để vẽ biểu đồ TQ3.</p>");
            console.warn("DEBUG TQ3: dataForChart rỗng sau tất cả các bước xử lý. Biểu đồ không được vẽ.");
            return;
        }
        
        // --- BẮT ĐẦU CODE D3.JS VẼ PIE CHART ---
        console.log("DEBUG TQ3: Bắt đầu quá trình vẽ D3.");
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseDimension = Math.min(containerRect.width > 0 ? containerRect.width * 0.95 : 350, 350);
        
        const chartWidth = baseDimension;
        const chartHeight = baseDimension; 
        const margin = { top: 50, right: 30, bottom: 50, left: 30 };

        const effectiveDiameter = Math.min(chartWidth - margin.left - margin.right, chartHeight - margin.top - margin.bottom);
        let radius = effectiveDiameter / 2;
        if (radius < 30) radius = 30;

        const innerRadius = 0; // PIE CHART: innerRadius = 0
        const outerRadius = radius * 0.9; 

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight + margin.top) 
            .append("g")
            .attr("transform", `translate(${chartWidth / 2}, ${chartHeight / 2 + margin.top / 2})`);

        const color = d3.scaleOrdinal()
            .domain(dataForChart.map(d => d.segment))
            .range(d3.schemeTableau10); 

        const pie = d3.pie()
            .value(d => d.Sales)
            .sort(null) 
            .padAngle(0.01)
            .startAngle(-50 * Math.PI / 180) 
            .endAngle(-50 * Math.PI / 180 + 2 * Math.PI);

        const data_ready = pie(dataForChart);

        const arcPath = d3.arc()
            .innerRadius(innerRadius) 
            .outerRadius(outerRadius);

        const outerArcForLabels = d3.arc()
            .innerRadius(outerRadius * 1.05) 
            .outerRadius(outerRadius * 1.05);

        const slices = svg.selectAll('g.slice-tq3')
            .data(data_ready)
            .join('g')
              .attr('class', 'slice-tq3')
              .style("cursor", "pointer");

        slices.append('path')
            .attr('d', arcPath)
            .attr('fill', d => color(d.data.segment))
            .attr("stroke", "white")
            .style("stroke-width", "1.5px");

        const labelLines = svg.selectAll("polyline.label-line-tq3")
            .data(data_ready)
            .join("polyline")
            .filter(d => (d.endAngle - d.startAngle) > 0.1) 
            .attr("class", "label-line-tq3")
            .style("fill", "none")
            .attr("stroke", d => d3.rgb(color(d.data.segment)).darker(0.3))
            .attr("stroke-width", 1)
            .attr("points", function(d) {
                const posA = arcPath.centroid(d); 
                const posB = outerArcForLabels.centroid(d); 
                const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                const xC = (outerRadius * 1.28) * Math.cos(midangle);
                const yC = (outerRadius * 1.28) * Math.sin(midangle);
                return [posA, posB, [xC, yC]];
            });

        const labelTexts = svg.selectAll("text.label-text-tq3")
            .data(data_ready)
            .join("text")
            .filter(d => (d.endAngle - d.startAngle) > 0.1) 
            .attr("class", "label-text-tq3")
            .html(d => { 
                const percentage = d.data.Percentage; 
                return `<tspan style="font-weight:bold;">${d.data.segment}</tspan> <tspan style="font-size:0.9em">(${percentage.toFixed(1)}%)</tspan>`;
            })
            .attr('transform', function(d) {
                const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                const xPos = (outerRadius * 1.33) * Math.cos(midangle); 
                const yPos = (outerRadius * 1.33) * Math.sin(midangle);
                return `translate(${xPos}, ${yPos})`;
            })
            .style('text-anchor', function(d) {
                const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                const angleDeg = (midangle * 180 / Math.PI); 
                return (angleDeg > 90 && angleDeg < 270) ? 'end' : 'start';
            })
            .style("font-size", "10px")
            .style("fill", d => d3.rgb(color(d.data.segment)).darker(0.7));
        
        // Tooltip
        slices
            .on("mouseover", function(event, d_pie) { 
                const d_data = d_pie.data;
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Phân khúc: ${d_data.segment}</strong><br/>
                     Doanh thu: $${d_data.Sales.toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                     Tỷ lệ: ${d_data.Percentage.toFixed(1)}%`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).select("path")
                  .transition().duration(100)
                  .attr("d", d3.arc().innerRadius(innerRadius).outerRadius(outerRadius * 1.05).padAngle(0.01).cornerRadius(3)(d_pie) );
            })
            .on("mouseout", function(event, d_pie) { 
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).select("path")
                  .transition().duration(100)
                  .attr("d", arcPath(d_pie)); 
            });

        // Tiêu đề
        svg.append("text")
            .attr("x", 0) 
            .attr("y", -chartHeight / 2 - margin.top / 2 + 15) // Điều chỉnh vị trí tiêu đề
            .attr("text-anchor", "middle")
            .style("font-size", "15px").style("font-weight", "bold").style("fill", "#333")
            .text("Doanh thu theo Phân khúc khách hàng"); // ĐÃ SỬA: Thêm tiêu đề

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ TQ3 (Pie Chart): ${error.message}</p>`);
        console.error("Lỗi drawChartTQ3:", error);
    }
}