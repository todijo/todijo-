import 'package:flutter/material.dart';

import 'todijo_theme.dart';

/// The same umbrella geometry used by the responsive Todijo wordmark.
class TodijoBrand extends StatelessWidget {
  const TodijoBrand({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Todijo',
    child: ExcludeSemantics(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 35,
            height: 35,
            child: CustomPaint(painter: _UmbrellaPainter()),
          ),
          if (!compact) ...[
            const SizedBox(width: 7),
            const Text(
              'Todijo.',
              style: TextStyle(
                color: TodijoColors.gold,
                fontFamily: 'Georgia',
                fontSize: 27,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

class _UmbrellaPainter extends CustomPainter {
  const _UmbrellaPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 64, size.height / 64);
    final canopy = Path()
      ..moveTo(7, 31)
      ..cubicTo(8.8, 17.2, 19.1, 8, 32, 8)
      ..cubicTo(44.9, 8, 55.2, 17.2, 57, 31)
      ..cubicTo(52.4, 27.5, 47.9, 27.5, 43.3, 31)
      ..cubicTo(39.5, 27.5, 35.7, 27.5, 32, 31)
      ..cubicTo(28.2, 27.5, 24.4, 27.5, 20.7, 31)
      ..cubicTo(16.1, 27.5, 11.6, 27.5, 7, 31)
      ..close();
    canvas.drawPath(canopy, Paint()..color = TodijoColors.forest);
    canvas.drawPath(
      canopy,
      Paint()
        ..color = TodijoColors.gold
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2,
    );
    final shaft = Path()
      ..moveTo(32, 8)
      ..lineTo(32, 50)
      ..cubicTo(32, 55.5, 40, 55.5, 40, 50);
    canvas.drawPath(
      shaft,
      Paint()
        ..color = TodijoColors.forest
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 4,
    );
    for (final rib in <Path>[
      Path()
        ..moveTo(20.7, 31)
        ..cubicTo(21.6, 19.6, 25.4, 12, 32, 8),
      Path()
        ..moveTo(43.3, 31)
        ..cubicTo(42.4, 19.6, 38.6, 12, 32, 8),
    ]) {
      canvas.drawPath(
        rib,
        Paint()
          ..color = TodijoColors.gold
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.8,
      );
    }
    canvas.drawCircle(
      const Offset(32, 7),
      3,
      Paint()..color = TodijoColors.gold,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
